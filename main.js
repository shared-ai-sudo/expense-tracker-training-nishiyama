// =============================================
// 支出記録アプリ メインスクリプト
// - localStorage による支出データ管理
// - フィルター、一覧表示、統計グラフの更新を担当
// =============================================

(function () {
  const STORAGE_KEY = "expense-tracker-data";
  const GAS_SCRIPT_ID = "AKfycbwYfbLQnKls-oxso5DdWdmTRA3fVN7TGcQvWQ7TRNP9Hg6avIV-GgCtB4ZW7lmHpXH7mg";
  const GAS_ENDPOINT = GAS_SCRIPT_ID ? `https://script.google.com/macros/s/${GAS_SCRIPT_ID}/exec` : "";
  const CATEGORY_OPTIONS = [
    "食費",
    "交通費",
    "娯楽",
    "光熱費",
    "通信費",
    "医療費",
    "衣服",
    "教育",
    "その他",
  ];

  const state = {
    expenses: [],
    filters: {
      period: "all",
      category: "all",
    },
  };

  // DOM 参照のキャッシュ
  const form = document.getElementById("expense-form");
  const dateInput = document.getElementById("expense-date");
  const amountInput = document.getElementById("expense-amount");
  const categoryInput = document.getElementById("expense-category");
  const memoInput = document.getElementById("expense-memo");
  const formError = document.getElementById("form-error");
  const filterButtons = document.querySelectorAll(".filter-button");
  const categoryFilter = document.getElementById("category-filter");
  const filteredTotal = document.getElementById("filtered-total");
  const currentMonthLabel = document.getElementById("current-month");
  const monthlyTotalLabel = document.getElementById("monthly-total");
  const tableBody = document.getElementById("expense-table-body");
  const categorySummaryList = document.getElementById("category-summary");
  const cloudStatusLabel = document.getElementById("cloud-sync-status");

  let cloudStatusTimeoutId = null;


  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // 初期化処理: カテゴリ選択肢を生成し、既存データを表示
  function init() {
    populateCategoryOptions();
    setDefaultDate();
    loadExpenses();
    initializeCloudStatus();
    bindEvents();
    render();
    syncExpensesToCloud(state.expenses, { silent: true });
  }

  // カテゴリ選択肢をフォームとフィルターに挿入
  function populateCategoryOptions() {
    CATEGORY_OPTIONS.forEach((category) => {
      const formOption = document.createElement("option");
      formOption.value = category;
      formOption.textContent = category;
      categoryInput.appendChild(formOption);

      const filterOption = document.createElement("option");
      filterOption.value = category;
      filterOption.textContent = category;
      categoryFilter.appendChild(filterOption);
    });
  }

  // 今日の日付をフォームにセット
  function setDefaultDate() {
    const today = new Date();
    const local = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
    dateInput.value = local.toISOString().slice(0, 10);
  }

  // イベントハンドラの登録
  function bindEvents() {
    form.addEventListener("submit", handleSubmit);
    tableBody.addEventListener("click", handleTableClick);
    filterButtons.forEach((button) => {
      button.addEventListener("click", () => handlePeriodFilter(button));
    });
    categoryFilter.addEventListener("change", () => {
      state.filters.category = categoryFilter.value;
      render();
    });
  }

  // localStorage から既存の支出データを読み込み
  function loadExpenses() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        state.expenses = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.expenses = parsed;
      } else {
        console.warn("Invalid data detected. Resetting expenses.");
        state.expenses = [];
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error("Failed to load expenses from storage.", error);
      state.expenses = [];
    }
  }

  // 支出データを localStorage に保存
  function saveExpenses() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses));
    } catch (error) {
      console.error("Failed to save expenses.", error);
      alert(
        "データの保存に失敗しました。保存容量を確認し、不要なデータを削除してください。"
      );
    }
  }

  // フォーム送信時の処理
  function handleSubmit(event) {
    event.preventDefault();
    const formData = gatherFormData();
    const validationMessage = validateExpense(formData);

    if (validationMessage) {
      formError.textContent = validationMessage;
      return;
    }

    formError.textContent = "";
    const expense = createExpense(formData);
    state.expenses.push(expense);
    state.expenses.sort(sortByCreatedAtDesc);
    saveExpenses();
    render();
    syncExpensesToCloud(state.expenses);
    resetForm();
  }

  // フォーム入力値を取得
  function gatherFormData() {
    return {
      date: dateInput.value,
      amount: amountInput.value,
      category: categoryInput.value,
      memo: memoInput.value.trim(),
    };
  }

  // 入力値のバリデーションを実施し、エラーメッセージを返却
  function validateExpense({ date, amount, category, memo }) {
    if (!date) {
      return "日付を入力してください。";
    }

    const selectedDate = parseLocalDate(date);
    if (!selectedDate) {
      return "有効な日付を入力してください。";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate.getTime() > today.getTime()) {
      return "未来の日付は入力できません。";
    }

    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedAmount)) {
      return "金額は整数で入力してください。";
    }
    if (parsedAmount < 1 || parsedAmount > 9_999_999) {
      return "金額は1円以上9,999,999円以下で入力してください。";
    }

    if (!category) {
      return "カテゴリを選択してください。";
    }

    if (memo.length > 100) {
      return "メモは100文字以内で入力してください。";
    }

    return "";
  }

  // 支出エントリを生成
  function createExpense({ date, amount, category, memo }) {
    const amountValue = Number(amount);
    const identifier =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    return {
      id: identifier,
      date,
      amount: amountValue,
      category,
      memo,
      createdAt: Date.now(),
    };
  }

  // フィルター切り替えボタンの処理
  function handlePeriodFilter(button) {
    const period = button.dataset.period;
    if (!period || period === state.filters.period) {
      return;
    }

    state.filters.period = period;
    filterButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn === button);
    });
    render();
  }

  // テーブル内のクリックイベント（削除ボタン）を処理
  function handleTableClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.matches(".delete-button")) {
      const { id } = target.dataset;
      if (!id) {
        return;
      }
      const confirmed = window.confirm("この支出を削除しますか？");
      if (!confirmed) {
        return;
      }
      state.expenses = state.expenses.filter((expense) => expense.id !== id);
      saveExpenses();
      render();
      syncExpensesToCloud(state.expenses);
    }
  }

  // UI 全体を最新状態に更新
  function render() {
    const sorted = [...state.expenses].sort(sortByDateDescThenCreated);
    const filtered = applyFilters(sorted);

    updateHeader(state.expenses);
    renderTable(filtered);
    updateFilteredTotal(filtered);
    renderCategorySummary(filtered);
    renderCategoryChart(filtered);
    renderTrendChart(state.expenses);
  }

  // 支出データの並び順（作成日時の新しい順）で比較
  function sortByCreatedAtDesc(a, b) {
    return b.createdAt - a.createdAt;
  }

  // 日付優先で降順ソートし、同日なら作成日時で降順
  function sortByDateDescThenCreated(a, b) {
    if (a.date === b.date) {
      return b.createdAt - a.createdAt;
    }
    return a.date < b.date ? 1 : -1;
  }

  // 現在のフィルター条件を適用
  function applyFilters(expenses) {
    return expenses.filter((expense) => {
      if (
        state.filters.category !== "all" &&
        expense.category !== state.filters.category
      ) {
        return false;
      }

      if (state.filters.period === "week" && !isWithinCurrentWeek(expense.date)) {
        return false;
      }

      if (state.filters.period === "month" && !isWithinCurrentMonth(expense.date)) {
        return false;
      }

      return true;
    });
  }

  // 指定日付が今週に含まれるか判定（月曜日開始で計算）
  function isWithinCurrentWeek(dateString) {
    const target = parseLocalDate(dateString);
    if (!target) {
      return false;
    }

    const today = new Date();
    const start = new Date(today);
    const day = today.getDay() === 0 ? 7 : today.getDay(); // 日曜=7
    start.setDate(today.getDate() - (day - 1));
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    target.setHours(0, 0, 0, 0);
    return target >= start && target < end;
  }

  // 指定日付が今月に含まれるか判定
  function isWithinCurrentMonth(dateString) {
    const target = parseLocalDate(dateString);
    if (!target) {
      return false;
    }

    const today = new Date();
    return (
      target.getFullYear() === today.getFullYear() &&
      target.getMonth() === today.getMonth()
    );
  }

  // ヘッダーに表示する現在の月と月次合計を更新
  function updateHeader(expenses) {
    const now = new Date();
    const monthLabel = new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
    }).format(now);
    currentMonthLabel.textContent = monthLabel;

    const monthlyTotal = expenses
      .filter((expense) => isWithinCurrentMonth(expense.date))
      .reduce((total, expense) => total + Number(expense.amount || 0), 0);

    monthlyTotalLabel.textContent = formatCurrency(monthlyTotal);
  }

  // 支出一覧をテーブルに描画
  function renderTable(expenses) {
    tableBody.innerHTML = "";

    if (expenses.length === 0) {
      const emptyRow = document.createElement("tr");
      emptyRow.className = "empty-row";
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = "条件に一致する支出はありません。";
      emptyRow.appendChild(cell);
      tableBody.appendChild(emptyRow);
      return;
    }

    const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    expenses.forEach((expense) => {
      const row = document.createElement("tr");

      const dateCell = document.createElement("td");
      const parsedDate = parseLocalDate(expense.date);
      dateCell.textContent = !parsedDate
        ? expense.date
        : dateFormatter.format(parsedDate);
      row.appendChild(dateCell);

      const categoryCell = document.createElement("td");
      categoryCell.textContent = expense.category;
      row.appendChild(categoryCell);

      const amountCell = document.createElement("td");
      amountCell.textContent = formatCurrency(expense.amount);
      row.appendChild(amountCell);

      const memoCell = document.createElement("td");
      memoCell.textContent = expense.memo || "-";
      row.appendChild(memoCell);

      const actionCell = document.createElement("td");
      actionCell.className = "action-column";
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-button";
      deleteButton.dataset.id = expense.id;
      deleteButton.textContent = "削除";
      actionCell.appendChild(deleteButton);
      row.appendChild(actionCell);

      tableBody.appendChild(row);
    });
  }

  // フィルター結果の合計金額を表示
  function updateFilteredTotal(expenses) {
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    filteredTotal.textContent = formatCurrency(total);
  }

  // カテゴリ別合計のリストを更新
  function renderCategorySummary(expenses) {
    categorySummaryList.innerHTML = "";
    if (expenses.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "データがありません。";
      categorySummaryList.appendChild(empty);
      return;
    }

    const totals = aggregateByCategory(expenses);
    Object.entries(totals)
      .filter(([, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, amount]) => {
        const item = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = category;
        const value = document.createElement("span");
        value.textContent = formatCurrency(amount);
        item.append(label, value);
        categorySummaryList.appendChild(item);
      });
  }

  // カテゴリ別支出グラフを描画
  function renderCategoryChart(expenses) {
    const canvas = document.getElementById("category-chart");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    const prepared = prepareCanvas(canvas);
    if (!prepared) {
      return;
    }
    const { ctx, width, height } = prepared;

    const totals = aggregateByCategory(expenses);
    const entries = Object.entries(totals).filter(([, amount]) => amount > 0);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 12;

    if (entries.length === 0) {
      ctx.fillStyle = "#f9fafb";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#9ca3af";
      ctx.font = "13px 'Helvetica Neue', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("データがありません。", centerX, centerY);
      return;
    }

    const palette = [
      "#1d4ed8",
      "#0ea5e9",
      "#22c55e",
      "#d97706",
      "#d946ef",
      "#ef4444",
      "#10b981",
      "#8b5cf6",
      "#f97316",
    ];

    const totalAmount = entries.reduce((sum, [, amount]) => sum + amount, 0);
    let startAngle = -Math.PI / 2;

    entries.forEach(([, amount], index) => {
      const sliceAngle = (amount / totalAmount) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = palette[index % palette.length];
      ctx.fill();

      startAngle = endAngle;
    });

    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 16px 'Helvetica Neue', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(formatCurrency(totalAmount), centerX, centerY - 6);

    ctx.fillStyle = "#6b7280";
    ctx.font = "12px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillText("合計", centerX, centerY + 16);
  }

  // 月次推移グラフを描画
  function renderTrendChart(expenses) {
    const canvas = document.getElementById("trend-chart");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    const prepared = prepareCanvas(canvas);
    if (!prepared) {
      return;
    }
    const { ctx, width, height } = prepared;

    const labels = [];
    const data = [];
    const monthFormatter = new Intl.DateTimeFormat("ja-JP", {
      month: "short",
    });

    const now = new Date();
    const monthKeys = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthKeys.push(key);
      labels.push(`${date.getFullYear()}年${monthFormatter.format(date)}`);
      data.push(0);
    }

    const totalsByMonth = expenses.reduce((accumulator, expense) => {
      const { date, amount } = expense;
      const expenseDate = parseLocalDate(date);
      if (!expenseDate) {
        return accumulator;
      }
      const key = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      if (!accumulator[key]) {
        accumulator[key] = 0;
      }
      accumulator[key] += Number(amount || 0);
      return accumulator;
    }, {});

    monthKeys.forEach((key, index) => {
      if (totalsByMonth[key]) {
        data[index] = totalsByMonth[key];
      }
    });

    const maxValue = Math.max(...data);
    const padding = { top: 24, right: 24, bottom: 44, left: 64 };
    const chartWidth = Math.max(width - padding.left - padding.right, 0);
    const chartHeight = Math.max(height - padding.top - padding.bottom, 0);

    if (maxValue === 0) {
      renderEmptyChart(ctx, width, height, "直近6か月のデータがありません。");
      drawXAxisLabels(ctx, labels, padding, chartWidth, chartHeight);
      return;
    }

    const scaleMax = Math.max(maxValue, 1);
    const ySteps = 4;

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let i = 0; i <= ySteps; i += 1) {
      const y = padding.top + (chartHeight / ySteps) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();

      const value = scaleMax * (1 - i / ySteps);
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px 'Helvetica Neue', Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(formatCurrency(Math.round(value)), padding.left - 8, y);
    }


    const xStep = data.length > 1 ? chartWidth / (data.length - 1) : 0;
    const points = data.map((value, index) => {
      const x = padding.left + xStep * index;
      const y =
        padding.top + chartHeight - (value / scaleMax) * chartHeight;
      return { x, y, value };
    });

    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + chartHeight);
    points.forEach((point) => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach((point, index) => {
      if (index === 0) {
        return;
      }
      ctx.lineTo(point.x, point.y);
    });
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#2563eb";
    ctx.stroke();

    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#1d4ed8";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    });

    drawXAxisLabels(ctx, labels, padding, chartWidth, chartHeight);
  }

  // Canvas を現在のデバイスピクセル比に合わせて初期化
  function prepareCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    const ratio = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth || canvas.width;
    const displayHeight = canvas.clientHeight || canvas.height;
    if (!displayWidth || !displayHeight) {
      return null;
    }
    canvas.width = displayWidth * ratio;
    canvas.height = displayHeight * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    return { ctx, width: displayWidth, height: displayHeight };
  }

  // データが無いときに表示するメッセージ描画
  function renderEmptyChart(ctx, width, height, message) {
    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#9ca3af";
    ctx.font = "13px 'Helvetica Neue', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, width / 2, height / 2);
  }

  // X軸ラベルを均等配置で描画
  function drawXAxisLabels(ctx, labels, padding, chartWidth, chartHeight) {
    if (!labels.length) {
      return;
    }
    const xStep = labels.length > 1 ? chartWidth / (labels.length - 1) : 0;
    ctx.fillStyle = "#6b7280";
    ctx.font = "11px 'Helvetica Neue', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    labels.forEach((label, index) => {
      const x = padding.left + xStep * index;
      const y = padding.top + chartHeight + 8;
      ctx.fillText(label, x, y);
    });
  }


  // ローカルタイムゾーンで日付文字列 (YYYY-MM-DD) を Date に変換
  function parseLocalDate(dateString) {
    if (typeof dateString !== "string") {
      return null;
    }
    const parts = dateString.split("-");
    if (parts.length !== 3) {
      return null;
    }
    const [yearStr, monthStr, dayStr] = parts;
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    const day = Number.parseInt(dayStr, 10);
    if ([year, month, day].some((value) => Number.isNaN(value))) {
      return null;
    }
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  // カテゴリごとに金額を集計
  function aggregateByCategory(expenses) {
    return expenses.reduce((accumulator, expense) => {
      const current = accumulator[expense.category] || 0;
      accumulator[expense.category] = current + Number(expense.amount || 0);
      return accumulator;
    }, {});
  }

  // 金額のフォーマット処理
  function formatCurrency(amount) {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(Number.isFinite(amount) ? amount : 0);
  }

  // フォームの入力状態を初期化
  function resetForm() {
    form.reset();
    setDefaultDate();
    if (categoryInput.options.length > 0) {
      categoryInput.selectedIndex = 0;
    }
  }

  // クラウド同期の状態表示を初期化
  function initializeCloudStatus() {
    if (cloudStatusLabel) {
      cloudStatusLabel.textContent = "";
    }
  }

  // クラウドへの支出データ同期
  function syncExpensesToCloud(expenses, options = {}) {
    if (!GAS_ENDPOINT) {
      return;
    }

    if (!options.silent && cloudStatusLabel) {
      cloudStatusLabel.textContent = "同期中...";
      cloudStatusLabel.className = "syncing";
    }

    if (cloudStatusTimeoutId) {
      clearTimeout(cloudStatusTimeoutId);
    }

    // Google Apps Script へデータを送信
    fetch(GAS_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "syncExpenses",
        expenses: expenses,
      }),
    })
      .then(() => {
        if (!options.silent && cloudStatusLabel) {
          cloudStatusLabel.textContent = "同期完了";
          cloudStatusLabel.className = "synced";
          cloudStatusTimeoutId = setTimeout(() => {
            cloudStatusLabel.textContent = "";
            cloudStatusLabel.className = "";
          }, 3000);
        }
      })
      .catch((error) => {
        console.error("Failed to sync to cloud:", error);
        if (!options.silent && cloudStatusLabel) {
          cloudStatusLabel.textContent = "同期失敗";
          cloudStatusLabel.className = "error";
          cloudStatusTimeoutId = setTimeout(() => {
            cloudStatusLabel.textContent = "";
            cloudStatusLabel.className = "";
          }, 5000);
        }
      });
  }
})();

// =============================================
// 課題完了報告機能
// =============================================
(function () {
  const completionButton = document.getElementById("completion-report-button");
  const completionModal = document.getElementById("completion-modal");
  const completionForm = document.getElementById("completion-form");
  const cancelButton = document.getElementById("cancel-button");
  const modalClose = document.querySelector(".modal-close");
  const completionError = document.getElementById("completion-error");
  const traineeNameInput = document.getElementById("trainee-name");
  const traineeIdInput = document.getElementById("trainee-id");
  const appUrlInput = document.getElementById("app-url");
  const specUrlInput = document.getElementById("spec-url");
  const GAS_SCRIPT_ID = "AKfycbwYfbLQnKls-oxso5DdWdmTRA3fVN7TGcQvWQ7TRNP9Hg6avIV-GgCtB4ZW7lmHpXH7mg";
  const GAS_ENDPOINT = GAS_SCRIPT_ID ? `https://script.google.com/macros/s/${GAS_SCRIPT_ID}/exec` : "";

  if (!completionButton || !completionModal) {
    return;
  }

  // モーダルを開く
  completionButton.addEventListener("click", () => {
    completionModal.classList.add("is-open");
    completionError.textContent = "";
    traineeNameInput.focus();
  });

  // モーダルを閉じる
  function closeModal() {
    completionModal.classList.remove("is-open");
    completionForm.reset();
    completionError.textContent = "";
  }

  cancelButton.addEventListener("click", closeModal);
  modalClose.addEventListener("click", closeModal);

  // モーダル背景クリックで閉じる
  completionModal.addEventListener("click", (e) => {
    if (e.target === completionModal) {
      closeModal();
    }
  });

  // Escキーでモーダルを閉じる
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && completionModal.classList.contains("is-open")) {
      closeModal();
    }
  });

  // フォーム送信
  completionForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    completionError.textContent = "";

    const traineeName = traineeNameInput.value.trim();
    const traineeId = traineeIdInput.value.trim();
    const appUrl = appUrlInput.value.trim();
    const specUrl = specUrlInput.value.trim();

    if (!traineeName || !traineeId || !appUrl || !specUrl) {
      completionError.textContent = "全ての項目を入力してください。";
      return;
    }

    if (!GAS_ENDPOINT) {
      completionError.textContent = "GASエンドポイントが設定されていません。";
      return;
    }

    const now = new Date();
    const formattedDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const reportData = {
      action: "submitCompletionReport",
      traineeName,
      traineeId,
      appUrl,
      specUrl,
      completedAt: formattedDate,
    };

    try {
      // ボタンを無効化
      const submitButton = completionForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = "送信中...";

      const response = await fetch(GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportData),
      });

      // no-corsモードではレスポンスを読めないため、送信が成功したと仮定
      alert("✅ 課題完了報告を送信しました！\n管理者のLINEに通知されます。");
      closeModal();
    } catch (error) {
      console.error("Failed to submit completion report:", error);
      completionError.textContent = "送信に失敗しました。もう一度お試しください。";
      const submitButton = completionForm.querySelector('button[type="submit"]');
      submitButton.disabled = false;
      submitButton.textContent = "送信";
    }
  });
})();
