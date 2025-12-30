const MOOD_DATA_URL = "./data.json";

let moodMessages = null;
let moodMessagesPromise = null;

function slugMood(label) {
  return (label || "")
    .toLowerCase()
    .trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadMoodMessages() {
  if (moodMessages) return Promise.resolve(moodMessages);
  if (moodMessagesPromise) return moodMessagesPromise;

  moodMessagesPromise = fetch(MOOD_DATA_URL, { cache: "no-store" })
    .then(r => {
      if (!r.ok) throw new Error("Impossibile caricare data.json");
      return r.json();
    })
    .then(json => {
      moodMessages = json;
      return moodMessages;
    })
    .catch(err => {
      console.warn(err);
      moodMessages = {};
      return moodMessages;
    });

  return moodMessagesPromise;
}

// ✅ Fullscreen viewer (una volta sola)
(function setupImageViewer(){
  const viewer = document.createElement("div");
  viewer.className = "image-viewer";
  viewer.setAttribute("aria-hidden", "true");

  const img = document.createElement("img");
  img.alt = "";
  viewer.appendChild(img);

  document.body.appendChild(viewer);

  function open(src){
    if (!src) return;
    img.src = src;
    viewer.classList.add("is-open");
    viewer.setAttribute("aria-hidden", "false");
  }

  function close(){
    viewer.classList.remove("is-open");
    viewer.setAttribute("aria-hidden", "true");
    img.src = "";
  }

  viewer.addEventListener("click", close);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // collega il click dell'immagine del modal
  const modalImage = document.getElementById("modalImage");
  if (modalImage) {
    modalImage.addEventListener("click", (e) => {
      e.stopPropagation();
      open(modalImage.src);
    });
  }
})();


function getShuffleState(key, total) {
  const storageKey = `looply_shuffle_${key}`;
  let state = null;

  try {
    state = JSON.parse(localStorage.getItem(storageKey));
  } catch {}

  const invalid =
    !state ||
    !Array.isArray(state.order) ||
    state.order.length !== total ||
    typeof state.index !== "number";

  if (invalid) {
    state = {
      order: shuffleArray([...Array(total).keys()]),
      index: 0
    };
  }

  return { state, storageKey };
}

function saveShuffleState(storageKey, state) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {}
}

window.openModalForMood = async function (moodName) {
  const key = slugMood(moodName);
  const data = await loadMoodMessages();
  const list = data[key];

  const modalImage = document.getElementById("modalImage");

  // ✅ RESET SEMPRE (hidden + display + src)
  if (modalImage) {
    modalImage.hidden = true;
    modalImage.style.display = "none";
    modalImage.removeAttribute("src");
  }

  if (!Array.isArray(list) || list.length === 0) {
    modalText.textContent = "“…”";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    return;
  }

  const { state, storageKey } = getShuffleState(key, list.length);
  const msgIndex = state.order[state.index];
  const message = list[msgIndex];

  state.index++;
  if (state.index >= state.order.length) {
    state.order = shuffleArray(state.order);
    state.index = 0;
  }
  saveShuffleState(storageKey, state);

  if (typeof message === "string") {
    modalText.textContent = `“${message}”`;
  } else {
    modalText.textContent = `“${message.text || "…"}”`;

    if (modalImage && message.image) {
      modalImage.src = message.image;
      modalImage.hidden = false;
      modalImage.style.display = "block";
    }
  }

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
};


// preload
loadMoodMessages();
