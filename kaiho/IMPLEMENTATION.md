# KAIHO Implementation Notes

KAIHOは、元ゲームのエンジンを使用して制作するデジタル会報です。

通常のWeb記事ではなく、キャラクター、会話、アニメーション、音楽、
操作などのゲーム表現を使って毎号の内容を届けます。グッズのQRコードが
会報への入口になり、公開内容は継続的に更新されます。

現在のページは、その最初の短い演出です。

## 公開日とカウントダウン

`src/entry.js`が日本時間の日付を判定します。

- 6月14日: モバイルゲーム画面と会話を起動
- 6月14日以外: コントローラーを生成せず、黒画面中央に残り日数を表示
- 6月14日を過ぎた場合: 翌年の6月14日までをカウント

```text
大阪ワンマンまであと5日
```

カウントダウン文字も`10px`、整数座標で描画します。

## ファイル構成

```text
kaiho/
├── assets/sprites/p4.png
├── fonts/PixelMplus10-Regular.ttf
├── src/
│   ├── dialog.js
│   ├── input.js
│   ├── main.js
│   └── mobile_controller.js
├── index.html
└── style.css
```

## P4素材

素材は元ゲームからコピーしています。

```text
game/assets/sprites/p4.png
  ↓
kaiho/assets/sprites/p4.png
```

`p4.png`は`32×16px`です。横方向に`16×16px`の歩行フレームが2枚並んでいます。

```text
┌────────┬────────┐
│ frame 0│ frame 1│
│ 16×16  │ 16×16  │
└────────┴────────┘
```

## Canvas

元ゲームのフィールドと同じ論理解像度を使用します。

```html
<canvas id="c" width="192" height="180"></canvas>
```

モバイルではCanvas全体が画面幅に合わせて拡大されます。ピクセル絵をぼかさないため、CSSに以下を指定します。

```css
canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

## P4の読み込み

```js
const p4 = new Image();
p4.src = "./assets/sprites/p4.png";
```

## P4の描画

元画像から表示するフレームだけを切り出します。

```js
ctx.drawImage(
  p4,
  frame * 16, 0, 16, 16,
  x, y, 32, 32,
);
```

- `frame`は`0`または`1`
- 元フレームは`16×16px`
- KAIHOではP4だけ2倍の`32×32px`で表示
- Canvas全体の拡大とは別に、キャラクター自体を2倍描画している

## 歩行アニメーション

元ゲームと同じく、2フレームを`180ms`間隔で切り替えます。

```js
if (now - lastFrameAt > 180) {
  frame ^= 1;
  lastFrameAt = now;
}
```

停止時は必ずフレーム0へ戻します。

```js
frame = 0;
```

歩行フレームが切り替わるたびに、`playPuyoStep()`で柔らかい足音を鳴らします。
左右の足で少し音程を変え、「ぷよっ、ぷよっ」と聞こえるようにしています。

## 移動

元ゲームの通常速度である「約1px/フレーム」を、時間基準の`60px/秒`として扱います。

```js
x += 60 * deltaMs / 1000;
```

時間基準にすることで、端末のフレームレートが変わっても移動時間が大きく変わりません。

中央停止位置は表示サイズから計算します。

```js
const characterSize = 32;
const stopX = Math.floor((canvas.width - characterSize) / 2);
```

## 演出の流れ

1. Canvasを黒く塗る
2. 起動から2秒間待つ
3. P4を画面左外から移動させる
4. 中央で停止させる
5. メッセージウィンドウを開く
6. セリフを文字送りで表示する

毎フレーム最初に黒く塗り直します。

```js
ctx.fillStyle = "#000";
ctx.fillRect(0, 0, canvas.width, canvas.height);
```

## メッセージウィンドウ

`src/dialog.js`は元ゲームの`ui_dialog.js`を参考にしています。

- 左右余白: `8px`
- 下余白: `8px`
- 高さ: `55px`
- 枠線: 白`2px`
- フォント: `PixelMplus10`の`10px`
- 文字座標: 必ず整数値
- 通常の文字送り: 1文字`60ms`
- 句読点の待ち時間: `360ms`
- 表示完了時: 右下に白い三角カーソル

```js
const rect = {
  x: 8,
  y: height - 55 - 8,
  w: width - 16,
  h: 55,
};
```

文字描画時は、座標を必ず整数へ丸めます。

```js
ctx.font = "10px PixelMplus10, monospace";
ctx.fillText(text, Math.round(x), Math.round(y));
```

Aボタンは内部的に`z`入力です。

- 文字送り中に押す: 全文表示
- 全文表示後に押す: ウィンドウを閉じる

## 会話SE

ブラウザの自動再生制限に対応するため、起動時に`PRESS ANY BUTTON`を表示します。
画面タップまたはモバイル操作によってWeb Audioを有効化してから、2秒待機と
P4の登場演出を開始します。

`src/se.js`には元ゲームのSE方式を抜き出した処理があります。

- 文字送り中: 短い矩形波のキャラクター音声
- Aボタンで全文表示: 2音の決定音
- Aボタンでウィンドウを閉じる: 2音の決定音

## はい・いいえの選択肢

`src/choice.js`で、質問文の下に「はい／いいえ」を表示できます。

- 初期選択: はい
- 左・上: はい
- 右・下: いいえ
- Aボタン: 選択中の項目を決定
- Bボタン: いいえを選択
- 選択移動時: カーソル音
- 決定時: 決定音

```js
choice.open("遊びに来るのか？", (index) => {
  if (index === 0) {
    // はい
  } else {
    // いいえ
  }
});
```

選択肢も`10px`フォントを使い、文字とボックスの座標は整数にします。

## モバイル筐体

`src/mobile_controller.js`はCanvasを`#screen-wrap`で囲み、その下に操作UIを追加します。

```js
const input = createInput();
setupMobileController(input);
```

P4とメッセージはCanvas内だけに描画されます。スティックやA/B/CボタンはCanvas外のモバイルUIです。

## 元ゲームとの対応

```text
game/src/config.js
  SPEED、FRAME_MS、論理解像度

game/src/main.js
  スプライトのフレーム切り出しと歩行処理

game/src/ui_dialog.js
  メッセージウィンドウと文字送り

game/src/input.js
  キーボード、ゲームパッド、タッチ入力

game/src/mobile_controller.js
  モバイル用スティックとボタン
```

今後キャラクターや会話を追加するときも、元ゲームの実装を確認してからKAIHO用に必要な部分だけを移植します。
