const uploadInput = document.getElementById("upload");
const emojizeBtn = document.getElementById("emojizeBtn");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let uploadedImage = null;
const emojiFolder = "ios_emojis/";
let emojiData = [];

const EMOJI_SIZE = 20; // size of each emoji tile
const EMOJI_SAMPLE_LIMIT = 60; // limit how many emojis to load

// Load emojis and precompute average color
async function loadEmojis() {
  const response = await fetch(emojiFolder); // this won't work locally — see note below
  const html = await response.text();
  const matches = [...html.matchAll(/href="([^?][^"]+\.png)"/g)].slice(0, EMOJI_SAMPLE_LIMIT);

  for (let match of matches) {
    const path = emojiFolder + match[1];
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = path;

    await new Promise((resolve) => {
      img.onload = () => {
        const tmp = document.createElement("canvas");
        tmp.width = tmp.height = EMOJI_SIZE;
        const tmpCtx = tmp.getContext("2d");
        tmpCtx.drawImage(img, 0, 0, EMOJI_SIZE, EMOJI_SIZE);
        const { data } = tmpCtx.getImageData(0, 0, EMOJI_SIZE, EMOJI_SIZE);

        let [r, g, b, count] = [0, 0, 0, 0];
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) { // alpha > 0
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        emojiData.push({
          img,
          avg: [r / count, g / count, b / count]
        });
        resolve();
      };
    });
  }
}

function colorDistance(c1, c2) {
  return Math.sqrt(
    (c1[0] - c2[0]) ** 2 +
    (c1[1] - c2[1]) ** 2 +
    (c1[2] - c2[2]) ** 2
  );
}

function findClosestEmoji(color) {
  let minDist = Infinity;
  let best = emojiData[0];
  for (let e of emojiData) {
    const d = colorDistance(e.avg, color);
    if (d < minDist) {
      minDist = d;
      best = e;
    }
  }
  return best.img;
}

uploadInput.addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      uploadedImage = img;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

emojizeBtn.addEventListener("click", async function () {
  if (!uploadedImage) {
    alert("Upload an image first.");
    return;
  }

  if (emojiData.length === 0) {
    emojizeBtn.textContent = "Loading Emojis...";
    await loadEmojis();
    emojizeBtn.textContent = "🎉 Emojize!";
  }

  // Resize canvas
  const cols = Math.floor(uploadedImage.width / EMOJI_SIZE);
  const rows = Math.floor(uploadedImage.height / EMOJI_SIZE);
  canvas.width = cols * EMOJI_SIZE;
  canvas.height = rows * EMOJI_SIZE;

  // Draw image to temp canvas
  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = cols;
  tmpCanvas.height = rows;
  const tmpCtx = tmpCanvas.getContext("2d");
  tmpCtx.drawImage(uploadedImage, 0, 0, cols, rows);
  const imgData = tmpCtx.getImageData(0, 0, cols, rows).data;

  // Draw emojis
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const color = [imgData[i], imgData[i + 1], imgData[i + 2]];
      const emoji = findClosestEmoji(color);
      ctx.drawImage(emoji, x * EMOJI_SIZE, y * EMOJI_SIZE, EMOJI_SIZE, EMOJI_SIZE);
    }
  }
});
