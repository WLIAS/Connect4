(function () {
  "use strict";

  const ROWS = 6;
  const COLS = 7;

  /** @type {number[][]} 0 empty, 1 P1, 2 P2 — row 0 is top */
  let grid = [];
  let currentPlayer = 1;
  let gameOver = false;
  let animating = false;

  /** @type {{ row: number; col: number; player: number; timeP1: number; timeP2: number }[]} */
  let moveStack = [];

  const settings = {
    colourScheme: "red-yellow",
    timerEnabled: false,
    minutesPerPlayer: 5,
  };

  let timeLeftMs = [0, 0];
  let timerRaf = 0;
  let lastTick = 0;

  const els = {
    screenMenu: document.getElementById("screen-menu"),
    screenOptions: document.getElementById("screen-options"),
    screenGame: document.getElementById("screen-game"),
    btnStart: document.getElementById("btn-start"),
    btnOptions: document.getElementById("btn-options"),
    btnOptionsBack: document.getElementById("btn-options-back"),
    btnUndo: document.getElementById("btn-undo"),
    btnGameMenu: document.getElementById("btn-game-menu"),
    optTimerEnabled: document.getElementById("opt-timer-enabled"),
    optTimerMinutes: document.getElementById("opt-timer-minutes"),
    optTimerMinutesOut: document.getElementById("opt-timer-minutes-out"),
    timerMinutesWrap: document.getElementById("timer-minutes-wrap"),
    timers: document.getElementById("timers"),
    timerP1: document.getElementById("timer-p1"),
    timerP2: document.getElementById("timer-p2"),
    timerP1Value: document.getElementById("timer-p1-value"),
    timerP2Value: document.getElementById("timer-p2-value"),
    turnText: document.getElementById("turn-text"),
    turnSwatch: document.getElementById("turn-swatch"),
    board: document.getElementById("board"),
    modalOverlay: document.getElementById("modal-overlay"),
    modalMessage: document.getElementById("modal-message"),
    modalPlayAgain: document.getElementById("modal-play-again"),
    modalMainMenu: document.getElementById("modal-main-menu"),
  };

  function emptyGrid() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function showScreen(name) {
    els.screenMenu.classList.toggle("screen--active", name === "menu");
    els.screenMenu.hidden = name !== "menu";
    els.screenOptions.classList.toggle("screen--active", name === "options");
    els.screenOptions.hidden = name !== "options";
    els.screenGame.classList.toggle("screen--active", name === "game");
    els.screenGame.hidden = name !== "game";
  }

  function loadSettingsFromForm() {
    const scheme = document.querySelector('input[name="colour-scheme"]:checked');
    settings.colourScheme = scheme ? scheme.value : "red-yellow";
    settings.timerEnabled = els.optTimerEnabled.checked;
    settings.minutesPerPlayer = Number(els.optTimerMinutes.value) || 5;
  }

  function applySchemeClass() {
    const s = settings.colourScheme === "black-white" ? "scheme-black-white" : "scheme-red-yellow";
    els.board.classList.remove("scheme-red-yellow", "scheme-black-white");
    els.board.classList.add(s);
    document.body.dataset.scheme = settings.colourScheme;
  }

  function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function stopTimerLoop() {
    if (timerRaf) {
      cancelAnimationFrame(timerRaf);
      timerRaf = 0;
    }
    lastTick = 0;
  }

  function tickTimers(now) {
    if (!settings.timerEnabled || gameOver) {
      return;
    }
    if (!lastTick) {
      lastTick = now;
      timerRaf = requestAnimationFrame(tickTimers);
      return;
    }
    const delta = now - lastTick;
    lastTick = now;
    const idx = currentPlayer - 1;
    timeLeftMs[idx] -= delta;
    if (timeLeftMs[idx] <= 0) {
      timeLeftMs[idx] = 0;
      updateTimerDisplay();
      endGameByTimeout();
      return;
    }
    updateTimerDisplay();
    timerRaf = requestAnimationFrame(tickTimers);
  }

  function startTimerLoop() {
    stopTimerLoop();
    if (!settings.timerEnabled || gameOver) return;
    lastTick = performance.now();
    timerRaf = requestAnimationFrame(tickTimers);
  }

  function endGameByTimeout() {
    stopTimerLoop();
    gameOver = true;
    const winner = currentPlayer === 1 ? 2 : 1;
    blockColumnInputs();
    els.btnUndo.disabled = true;
    showModal(
      "Time's up",
      `Player ${winner} wins — Player ${currentPlayer} ran out of time.`
    );
  }

  function updateTimerDisplay() {
    if (!settings.timerEnabled) return;
    els.timerP1Value.textContent = formatTime(timeLeftMs[0]);
    els.timerP2Value.textContent = formatTime(timeLeftMs[1]);

    els.timerP1.classList.remove("timer--active-p1", "timer--active-p2", "timer--inactive");
    els.timerP2.classList.remove("timer--active-p1", "timer--active-p2", "timer--inactive");

    if (gameOver) {
      els.timerP1.classList.add("timer--inactive");
      els.timerP2.classList.add("timer--inactive");
      return;
    }

    if (currentPlayer === 1) {
      els.timerP1.classList.add("timer--active-p1");
      els.timerP2.classList.add("timer--inactive");
    } else {
      els.timerP2.classList.add("timer--active-p2");
      els.timerP1.classList.add("timer--inactive");
    }
  }

  function initTimersForGame() {
    const total = settings.minutesPerPlayer * 60 * 1000;
    timeLeftMs = [total, total];
    els.timers.hidden = !settings.timerEnabled;
    if (settings.timerEnabled) {
      updateTimerDisplay();
      startTimerLoop();
    } else {
      stopTimerLoop();
    }
  }

  function getCellElement(row, col) {
    return els.board.querySelector(`.board__cell[data-row="${row}"][data-col="${col}"]`);
  }

  function buildBoard() {
    els.board.innerHTML = "";
    els.board.style.display = "grid";
    els.board.style.gridTemplateColumns = `repeat(${COLS}, var(--cell))`;
    els.board.style.gridTemplateRows = `repeat(${ROWS}, var(--cell))`;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div");
        cell.className = "board__cell";
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        cell.style.gridRow = String(r + 1);
        cell.style.gridColumn = String(c + 1);
        const hole = document.createElement("div");
        hole.className = "board__cell-hole";
        cell.appendChild(hole);
        els.board.appendChild(cell);
      }
    }

    for (let c = 0; c < COLS; c++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "board__drop-zone";
      btn.dataset.col = String(c);
      btn.style.gridColumn = String(c + 1);
      btn.style.gridRow = "1 / -1";
      btn.setAttribute("aria-label", `Drop piece in column ${c + 1}`);
      btn.addEventListener("click", () => onColumnClick(c));
      els.board.appendChild(btn);
    }
  }

  function lowestEmptyRow(col) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][col] === 0) return r;
    }
    return -1;
  }

  function columnFull(col) {
    return grid[0][col] !== 0;
  }

  function checkWin(player, row, col) {
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (const sign of [1, -1]) {
        let r = row + dr * sign;
        let c = col + dc * sign;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === player) {
          count++;
          r += dr * sign;
          c += dc * sign;
        }
      }
      if (count >= 4) return true;
    }
    return false;
  }

  function boardFull() {
    for (let c = 0; c < COLS; c++) {
      if (grid[0][c] === 0) return false;
    }
    return true;
  }

  function blockColumnInputs() {
    els.board.querySelectorAll(".board__drop-zone").forEach((b) => {
      b.classList.add("board__drop-zone--blocked");
      b.disabled = true;
    });
  }

  function refreshColumnStates() {
    els.board.querySelectorAll(".board__drop-zone").forEach((b) => {
      const col = Number(b.dataset.col);
      const full = columnFull(col) || gameOver;
      b.disabled = full;
      b.classList.toggle("board__drop-zone--blocked", full);
    });
  }

  function updateTurnUI() {
    els.turnText.textContent = currentPlayer === 1 ? "Player 1" : "Player 2";
    const scheme =
      settings.colourScheme === "black-white" ? "scheme-black-white" : "scheme-red-yellow";
    els.turnSwatch.className = "turn-swatch piece " + (currentPlayer === 1 ? "piece--p1" : "piece--p2") + " " + scheme;
    updateTimerDisplay();
  }

  function animateDrop(col, row, player, done) {
    const targetCell = getCellElement(row, col);
    const topCell = getCellElement(0, col);
    if (!targetCell || !topCell) {
      done();
      return;
    }

    const scheme =
      settings.colourScheme === "black-white" ? "scheme-black-white" : "scheme-red-yellow";

    const piece = document.createElement("div");
    piece.className =
      "piece piece--falling " +
      (player === 1 ? "piece--p1" : "piece--p2") +
      " " +
      scheme;

    // Position relative to the board element
    const boardRect = els.board.getBoundingClientRect();
    const targetRect = targetCell.getBoundingClientRect();
    const topRect = topCell.getBoundingClientRect();

    const startY = topRect.top - boardRect.top + topRect.height / 2;
    const endY = targetRect.top - boardRect.top + targetRect.height / 2;
    const centerX = targetRect.left - boardRect.left + targetRect.width / 2;

    piece.style.position = "absolute";
    piece.style.left = centerX + "px";
    piece.style.top = startY + "px";
    piece.style.transform = "translate(-50%, -50%)";
    piece.style.zIndex = "50";
    piece.style.pointerEvents = "none";

    // Board must be position:relative for absolute children to work
    els.board.style.position = "relative";
    els.board.appendChild(piece);

    const fallDistance = Math.max(0, endY - startY);
    const duration = Math.min(600, 80 + fallDistance * 1.1);
    const start = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      // Ease-in (accelerate like gravity)
      const eased = t * t;
      const y = startY + fallDistance * eased;
      piece.style.top = y + "px";
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        // Bounce effect
        let bounceStart = performance.now();
        const bounceHeight = Math.min(fallDistance * 0.08, 10);
        const bounceDuration = 120;

        function bounce(now2) {
          const bt = Math.min(1, (now2 - bounceStart) / bounceDuration);
          const by = endY - bounceHeight * Math.sin(bt * Math.PI);
          piece.style.top = by + "px";
          if (bt < 1) {
            requestAnimationFrame(bounce);
          } else {
            piece.remove();
            done();
          }
        }
        requestAnimationFrame(bounce);
      }
    }
    requestAnimationFrame(frame);
  }

  function placePieceInCell(row, col, player) {
    const cell = getCellElement(row, col);
    if (!cell) return;
    const scheme =
      settings.colourScheme === "black-white" ? "scheme-black-white" : "scheme-red-yellow";
    const piece = document.createElement("div");
    piece.className =
      "piece " + (player === 1 ? "piece--p1" : "piece--p2") + " " + scheme;
    cell.appendChild(piece);
  }

  function onColumnClick(col) {
    if (gameOver || animating) return;
    if (columnFull(col)) return;

    const row = lowestEmptyRow(col);
    if (row < 0) return;

    animating = true;
    stopTimerLoop();

    const player = currentPlayer;
    const t1 = timeLeftMs[0];
    const t2 = timeLeftMs[1];

    animateDrop(col, row, player, () => {
      grid[row][col] = player;
      placePieceInCell(row, col, player);
      moveStack.push({ row, col, player, timeP1: t1, timeP2: t2 });

      if (checkWin(player, row, col)) {
        stopTimerLoop();
        gameOver = true;
        blockColumnInputs();
        els.btnUndo.disabled = true;
        updateTurnUI();
        animating = false;
        showModal("We have a winner!", `Player ${player} wins!`);
        return;
      }

      if (boardFull()) {
        stopTimerLoop();
        gameOver = true;
        blockColumnInputs();
        els.btnUndo.disabled = true;
        updateTurnUI();
        animating = false;
        showModal("Draw", "The board is full — it's a draw.");
        return;
      }

      currentPlayer = player === 1 ? 2 : 1;
      els.btnUndo.disabled = moveStack.length === 0;
      updateTurnUI();
      refreshColumnStates();
      animating = false;
      if (settings.timerEnabled && !gameOver) startTimerLoop();
    });
  }

  function showModal(title, message) {
    document.getElementById("modal-title").textContent = title;
    els.modalMessage.textContent = message;
    els.modalOverlay.hidden = false;
  }

  function hideModal() {
    els.modalOverlay.hidden = true;
  }

  function undo() {
    if (gameOver || animating || moveStack.length === 0) return;

    stopTimerLoop();

    const last = moveStack.pop();
    grid[last.row][last.col] = 0;
    currentPlayer = last.player;
    timeLeftMs[0] = last.timeP1;
    timeLeftMs[1] = last.timeP2;

    const cell = getCellElement(last.row, last.col);
    const p = cell && cell.querySelector(".piece:not(.piece--falling)");
    if (p) p.remove();

    els.btnUndo.disabled = moveStack.length === 0;
    updateTurnUI();
    refreshColumnStates();
    if (settings.timerEnabled) startTimerLoop();
  }

  function startGame() {
    loadSettingsFromForm();
    applySchemeClass();
    emptyGrid();
    currentPlayer = 1;
    gameOver = false;
    animating = false;
    moveStack = [];
    buildBoard();
    initTimersForGame();
    els.btnUndo.disabled = true;
    updateTurnUI();
    refreshColumnStates();
    showScreen("game");
  }

  function resetGameFromModal() {
    hideModal();
    startGame();
  }

  function goMainMenuFromModal() {
    hideModal();
    stopTimerLoop();
    showScreen("menu");
  }

  /* Options UI */
  function syncTimerMinutesVisibility() {
    els.timerMinutesWrap.hidden = !els.optTimerEnabled.checked;
  }

  els.optTimerEnabled.addEventListener("change", syncTimerMinutesVisibility);
  els.optTimerMinutes.addEventListener("input", () => {
    els.optTimerMinutesOut.textContent = els.optTimerMinutes.value;
  });

  els.btnStart.addEventListener("click", startGame);
  els.btnOptions.addEventListener("click", () => showScreen("options"));
  els.btnOptionsBack.addEventListener("click", () => showScreen("menu"));
  els.btnUndo.addEventListener("click", undo);
  els.btnGameMenu.addEventListener("click", () => {
    if (gameOver || confirm("Leave game and return to the main menu?")) {
      stopTimerLoop();
      showScreen("menu");
    }
  });

  els.modalPlayAgain.addEventListener("click", resetGameFromModal);
  els.modalMainMenu.addEventListener("click", goMainMenuFromModal);

  syncTimerMinutesVisibility();
  els.optTimerMinutesOut.textContent = els.optTimerMinutes.value;
})();
