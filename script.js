
/* =========================================================
   Language Lab
   首页交互逻辑
   功能：主题切换、每日新闻获取与展示
   ========================================================= */


/* =========================================================
   一、获取页面元素
   ========================================================= */

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeColor = document.querySelector('meta[name="theme-color"]');

const dailyArticles = document.getElementById("dailyArticles");
const dailyUpdateTime = document.getElementById("dailyUpdateTime");


/* =========================================================
   二、主题切换
   ========================================================= */

// 根据用户选择应用浅色或深色主题
function applyTheme(theme) {

  // 判断是否启用深色模式
  const isDark = theme === "dark";

  document.body.classList.toggle("dark-theme", isDark);

  // 更新主题按钮图标
  themeIcon.textContent = isDark ? "☀" : "☾";

  // 更新浏览器地址栏主题颜色
  themeColor.setAttribute(
    "content",
    isDark ? "#151619" : "#ffffff"
  );

  // 保存用户的主题选择
  localStorage.setItem("language-lab-theme", theme);
}


// 优先读取用户上次保存的主题
const savedTheme = localStorage.getItem("language-lab-theme");

// 如果没有保存过主题，则跟随系统设置
const systemPrefersDark = window.matchMedia(
  "(prefers-color-scheme: dark)"
).matches;

// 确定页面初始主题
const initialTheme = savedTheme || (
  systemPrefersDark ? "dark" : "light"
);

// 页面加载时应用主题
applyTheme(initialTheme);


// 监听主题切换按钮
themeToggle.addEventListener("click", function () {

  // 判断当前主题
  const isDark = document.body.classList.contains("dark-theme");

  // 切换主题
  applyTheme(isDark ? "light" : "dark");

});


/* =========================================================
   三、每日新闻接口配置
   ========================================================= */

// Language Lab 独立 Cloudflare Worker 地址
const NEWS_API_URL =
  "https://language-lab-api.pxy33310.workers.dev/news";

// 三种语言的显示信息
const LANGUAGE_CONFIG = {
  en: {
    code: "EN",
    name: "ENGLISH",
    labelClass: "english-label"
  },

  fr: {
    code: "FR",
    name: "FRANÇAIS",
    labelClass: "french-label"
  },

  ru: {
    code: "RU",
    name: "РУССКИЙ",
    labelClass: "russian-label"
  }
};


/* =========================================================
   四、日期格式化
   ========================================================= */

// 将 RSS 发布时间转换为简洁的日期格式

/* 将 RSS 发布时间转换为本地日期和时间 */
function formatNewsDate(dateString) {

  const date = new Date(dateString);

  // 如果日期无效，则显示备用文字
  if (Number.isNaN(date.getTime())) {
    return "日期未知";
  }

  // 按照访问者设备的本地时区显示
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}





/* =========================================================
   五、创建新闻卡片
   ========================================================= */

// 使用 DOM 方法创建元素，避免直接插入 RSS 原始 HTML
function createArticleElement(article) {

  const config = LANGUAGE_CONFIG[article.language];

  // 忽略不支持的语言数据
  if (!config) {
    return null;
  }

  // 创建可点击的文章卡片
  const item = document.createElement("article");

  item.className = "article-item";

// 根据语言为整张卡片添加专属样式
  item.classList.add(`article-${article.language}`);
  item.setAttribute("role", "link");
  item.setAttribute("tabindex", "0");
  item.setAttribute("aria-label", article.title);

  // 创建新闻配图
  let image = null;

  // 只允许加载安全的 HTTPS 图片地址
  try {
    if (article.image) {
      const imageUrl = new URL(article.image);

      if (imageUrl.protocol === "https:") {
        image = document.createElement("img");

        image.className = "article-image";
        image.src = imageUrl.href;
        image.alt = article.title || "News image";
        image.loading = "lazy";
        image.decoding = "async";

        // 图片加载失败时移除图片，不影响卡片内容
        image.addEventListener("error", function () {
          image.remove();
        }, { once: true });
      }
    }
  } catch (error) {
    console.warn("新闻配图地址无效：", error);
  }

  // 创建语言标识
  const language = document.createElement("div");

  language.className =
    `article-language ${config.labelClass}`;

  language.textContent = config.code;

  // 创建文章内容区域
  const content = document.createElement("div");

  content.className = "article-content";

  // 创建文章元信息
  const meta = document.createElement("div");

  meta.className = "article-meta";

  const languageName = document.createElement("span");

  languageName.textContent = config.name;

  const readingLabel = document.createElement("span");

  readingLabel.textContent = "TODAY'S READING";

  meta.append(languageName, readingLabel);

  // 创建文章标题
  const title = document.createElement("h3");

  title.textContent = article.title;

  // 创建文章底部信息
  const footer = document.createElement("div");

  footer.className = "article-footer";

  const date = document.createElement("span");

  date.textContent = formatNewsDate(article.pubDate);

  // 创建媒体来源标识
  const source = document.createElement("span");

  source.className = "article-source";

  // 获取原始媒体名称
  const sourceName = String(article.source || "NEWS");

  // 根据媒体名称生成简洁徽标
  if (/rfi/i.test(sourceName)) {
    source.textContent = "RFI";
  } else if (/bbc/i.test(sourceName)) {
    source.textContent = "BBC";
  } else {
    source.textContent = sourceName;
  }

  // 保留完整来源名称，方便辅助阅读
  source.setAttribute("aria-label", `新闻来源：${sourceName}`);
  source.title = sourceName;

  // 添加到文章底部
  footer.append(date, source);

  // 组合文章内容
  content.append(meta, title, footer);

  // 创建右侧跳转图标
  const arrow = document.createElement("span");

  arrow.className = "article-arrow";
  arrow.textContent = "↗";
  arrow.setAttribute("aria-hidden", "true");

  // 按顺序组合新闻配图、语言标识、文章内容和跳转图标
  if (image) {
    item.append(image);
  }

  // 不再单独显示 EN / FR / RU 色块
  // 语言颜色将应用于整张新闻卡片
  item.append(content, arrow);

  // 点击卡片打开新闻原文
  function openArticle() {

    // 只允许安全的 HTTPS 新闻链接
    try {
      const articleUrl = new URL(article.link);

      if (articleUrl.protocol !== "https:") {
        return;
      }

      window.open(
        articleUrl.href,
        "_blank",
        "noopener,noreferrer"
      );

    } catch (error) {
      console.error("新闻链接无效：", error);
    }
  }

  item.addEventListener("click", openArticle);

  // 支持键盘 Enter 和空格键访问
  item.addEventListener("keydown", function (event) {

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openArticle();
    }

  });

  return item;
}


/* =========================================================
   六、显示新闻获取失败状态
   ========================================================= */

// 在新闻列表中显示友好的提示
function showNewsError(message) {

  dailyArticles.replaceChildren();

  const error = document.createElement("div");

  error.className = "daily-error";
  error.textContent = message;

  dailyArticles.appendChild(error);

  dailyUpdateTime.textContent = "RSS · UNAVAILABLE";
}


/* =========================================================
   七、从 Cloudflare Worker 获取新闻
   ========================================================= */

async function loadDailyNews() {

  // 显示加载提示
  dailyArticles.replaceChildren();

  const loading = document.createElement("div");

  loading.className = "daily-loading";
  loading.textContent = "正在获取今日文章……";

  dailyArticles.appendChild(loading);

  try {

    // 请求 Worker 新闻接口
    const response = await fetch(NEWS_API_URL, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      cache: "no-cache"
    });

    // 检查 HTTP 请求状态
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // 解析 JSON 数据
    const data = await response.json();

    // 检查接口返回结果
    if (!data || !Array.isArray(data.news)) {
      throw new Error("新闻数据格式不正确");
    }

    // 清除加载提示
    dailyArticles.replaceChildren();

    // 记录成功显示的文章数量
    let displayedCount = 0;

    // 按照英语、法语、俄语的顺序展示新闻
    const languageOrder = ["en", "fr", "ru"];

    languageOrder.forEach(function (language) {

      // 找到对应语言的新闻
      const result = data.news.find(function (item) {
        return item.language === language;
      });

      // 如果该语言获取失败，显示单独的提示
      if (
        !result ||
        result.status !== "success" ||
        !result.article
      ) {

        const error = document.createElement("div");

        error.className = "daily-error";
        error.textContent =
          `${LANGUAGE_CONFIG[language].name} · 暂时无法获取文章`;

        dailyArticles.appendChild(error);

        return;
      }

      // 创建新闻卡片
      const articleElement = createArticleElement(
        result.article
      );

      if (articleElement) {
        dailyArticles.appendChild(articleElement);
        displayedCount++;
      }

    });

    // 更新底部状态
    if (displayedCount > 0) {

      dailyUpdateTime.textContent =
        `${displayedCount} ARTICLES · RSS`;

    } else {

      showNewsError("暂时没有获取到新闻，请稍后再试。");

    }

  } catch (error) {

    // 输出错误信息，方便后续排查
    console.error("Language Lab 新闻获取失败：", error);

    // 显示友好的错误提示
    showNewsError(
      "暂时无法获取今日文章，请检查网络或稍后再试。"
    );

  }

}


/* =========================================================
   八、页面初始化
   ========================================================= */

// 页面加载后自动获取每日新闻
loadDailyNews();



/* =========================================================
   九、Alphabet Learning · 跨平台语音朗读
   适配 iPhone Edge、Safari、Android Edge、Chrome
   使用设备原生 SpeechSynthesis，不依赖第三方 API
   ========================================================= */


// ---------- 1. 字母表配置 ----------

const ALPHABET_CONFIG = {

  // 法语标准字母表
  fr: {
    locale: "fr-FR",
    container: "frenchAlphabet",
    letters: [
      ["A", "a"], ["B", "bé"], ["C", "cé"],
      ["D", "dé"], ["E", "e"], ["F", "effe"],
      ["G", "gé"], ["H", "ache"], ["I", "i"],
      ["J", "ji"], ["K", "ka"], ["L", "elle"],
      ["M", "emme"], ["N", "enne"], ["O", "o"],
      ["P", "pé"], ["Q", "ku"], ["R", "erre"],
      ["S", "esse"], ["T", "té"], ["U", "u"],
      ["V", "vé"], ["W", "double vé"], ["X", "ixe"],
      ["Y", "i grec"], ["Z", "zède"]
    ]
  },

  // 俄语现代西里尔字母表
  ru: {
    locale: "ru-RU",
    container: "russianAlphabet",
    letters: [
      ["А", "а"], ["Б", "бэ"], ["В", "вэ"],
      ["Г", "гэ"], ["Д", "дэ"], ["Е", "е"],
      ["Ё", "ё"], ["Ж", "жэ"], ["З", "зэ"],
      ["И", "и"], ["Й", "и краткое"], ["К", "ка"],
      ["Л", "эль"], ["М", "эм"], ["Н", "эн"],
      ["О", "о"], ["П", "пэ"], ["Р", "эр"],
      ["С", "эс"], ["Т", "тэ"], ["У", "у"],
      ["Ф", "эф"], ["Х", "ха"], ["Ц", "цэ"],
      ["Ч", "че"], ["Ш", "ша"], ["Щ", "ща"],
      ["Ъ", "твёрдый знак"], ["Ы", "ы"],
      ["Ь", "мягкий знак"], ["Э", "э"],
      ["Ю", "ю"], ["Я", "я"]
    ]
  }

};


// ---------- 2. 语音引擎检测 ----------

const alphabetSpeechSupported =
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  "SpeechSynthesisUtterance" in window;

const alphabetSynth = alphabetSpeechSupported
  ? window.speechSynthesis
  : null;

// 缓存设备提供的语音列表
let alphabetVoices = [];

// 当前播放状态
let alphabetIsPlaying = false;

// 当前播放队列
let alphabetQueue = [];

// 播放任务编号
let alphabetTaskId = 0;

// 当前高亮按钮
let alphabetCurrentButton = null;

// 当前播放语言
let alphabetCurrentLanguage = null;

// 队列切换计时器
let alphabetNextTimer = null;


// ---------- 3. 获取设备语音 ----------

function refreshAlphabetVoices() {

  if (!alphabetSynth) return;

  try {
    alphabetVoices = alphabetSynth.getVoices() || [];
  } catch (error) {
    console.warn("获取系统语音失败：", error);
    alphabetVoices = [];
  }

}

// 页面初始化时先获取一次
refreshAlphabetVoices();

// Android 和部分浏览器会在语音加载完成后触发此事件
if (alphabetSynth) {

  alphabetSynth.addEventListener(
    "voiceschanged",
    refreshAlphabetVoices
  );

}


// ---------- 4. 页面状态提示 ----------

function setAlphabetStatus(language, message) {

  const config = ALPHABET_CONFIG[language];

  if (!config) return;

  const container = document.getElementById(
    config.container
  );

  if (!container) return;

  const card = container.closest(
    ".alphabet-language-card"
  );

  if (!card) return;

  let status = card.querySelector(
    ".alphabet-status"
  );

  if (!status) {

    status = document.createElement("div");

    status.className = "alphabet-status";

    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    card.appendChild(status);

  }

  status.textContent = message;

}


// ---------- 5. 生成字母按钮 ----------

function renderAlphabet() {

  Object.entries(ALPHABET_CONFIG).forEach(
    ([language, config]) => {

      const container = document.getElementById(
        config.container
      );

      if (!container) return;

      const fragment = document.createDocumentFragment();

      config.letters.forEach(([letter, speech]) => {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "alphabet-letter";

        button.textContent = letter;

        button.dataset.language = language;
        button.dataset.speak = speech;

        button.setAttribute(
          "aria-label",
          `朗读字母 ${letter}`
        );

        button.title = `点击听 ${letter} 的发音`;

        fragment.appendChild(button);

      });

      container.replaceChildren(fragment);

    }
  );

}


// ---------- 6. 播放状态管理 ----------

function clearAlphabetHighlight() {

  if (alphabetCurrentButton) {

    alphabetCurrentButton.classList.remove(
      "is-speaking"
    );

    alphabetCurrentButton = null;

  }

}


function resetAlphabetButtons() {

  document.querySelectorAll(
    "[data-play-alphabet]"
  ).forEach(button => {

    button.innerHTML = "<span>▶</span> 播放全部";

    button.setAttribute(
      "aria-pressed",
      "false"
    );

  });

}


function stopAlphabetSpeech() {

  // 让旧播放任务的回调失效
  alphabetTaskId++;

  alphabetIsPlaying = false;

  alphabetQueue = [];

  alphabetCurrentLanguage = null;

  if (alphabetNextTimer !== null) {

    clearTimeout(alphabetNextTimer);

    alphabetNextTimer = null;

  }

  // 只在用户主动停止或切换字母时取消语音
  if (alphabetSynth) {

    try {
      alphabetSynth.cancel();
    } catch (error) {
      console.warn("停止语音失败：", error);
    }

  }

  clearAlphabetHighlight();

  resetAlphabetButtons();

}


// ---------- 7. 选择合适的系统语音 ----------

function createAlphabetUtterance(language, speech) {

  const config = ALPHABET_CONFIG[language];

  if (!config) return null;

  const utterance = new SpeechSynthesisUtterance(
    speech
  );

  // 设置语言，作为没有匹配语音时的回退方案
  utterance.lang = config.locale;

  utterance.rate = 0.85;
  utterance.pitch = 1;
  utterance.volume = 1;

  // 每次创建语音对象时重新检查语音列表
  refreshAlphabetVoices();

  // 优先选择完全匹配的语言
  const exactVoice = alphabetVoices.find(voice =>
    voice.lang.toLowerCase() ===
    config.locale.toLowerCase()
  );

  // 其次接受同语言的其他地区版本
  const regionalVoice = alphabetVoices.find(voice =>
    voice.lang.toLowerCase().startsWith(
      language + "-"
    )
  );

  const matchedVoice = exactVoice || regionalVoice;

  // 找到对应语音才指定，不强制使用错误语言
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  return utterance;

}


// ---------- 8. 单个字母朗读 ----------

function speakSingleAlphabet(
  language,
  speech,
  button
) {

  if (!alphabetSpeechSupported) {

    alert("当前浏览器不支持语音朗读，请更换浏览器。");

    return;

  }

  // 先结束上一个播放任务
  stopAlphabetSpeech();

  const utterance = createAlphabetUtterance(
    language,
    speech
  );

  if (!utterance) return;

  const taskId = alphabetTaskId;

  alphabetCurrentLanguage = language;

  if (button) {

    alphabetCurrentButton = button;

    button.classList.add("is-speaking");

  }

  setAlphabetStatus(language, "正在播放……");

  utterance.onend = function () {

    if (taskId !== alphabetTaskId) return;

    clearAlphabetHighlight();

    setAlphabetStatus(language, "播放完成");

  };

  utterance.onerror = function (event) {

    if (taskId !== alphabetTaskId) return;

    clearAlphabetHighlight();

    console.error("单字母朗读失败：", event.error);

    setAlphabetStatus(
      language,
      "朗读失败：" + event.error + "。请检查设备语音设置。"
    );

  };

  // 保持在真实点击事件中启动，兼容移动端交互限制
  try {

    alphabetSynth.speak(utterance);

  } catch (error) {

    clearAlphabetHighlight();

    console.error("启动语音失败：", error);

    setAlphabetStatus(
      language,
      "无法启动语音，请检查系统语音服务。"
    );

  }

}


// ---------- 9. 播放全部 ----------

function playAlphabet(language) {

  if (!alphabetSpeechSupported) {

    alert("当前浏览器不支持语音朗读。");

    return;

  }

  const config = ALPHABET_CONFIG[language];

  if (!config) return;

  // 再次点击正在播放的按钮时，停止播放
  if (
    alphabetIsPlaying &&
    alphabetCurrentLanguage === language
  ) {

    stopAlphabetSpeech();

    setAlphabetStatus(language, "已停止播放");

    return;

  }

  // 停止之前的任务
  stopAlphabetSpeech();

  // 新任务编号
  const taskId = alphabetTaskId;

  alphabetIsPlaying = true;

  alphabetCurrentLanguage = language;

  // 创建播放队列
  alphabetQueue = config.letters.map(
    ([letter, speech]) => ({
      letter,
      speech,
      language
    })
  );

  // 更新按钮
  const playButton = document.querySelector(
    `[data-play-alphabet="${language}"]`
  );

  if (playButton) {

    playButton.innerHTML = "<span>■</span> 停止播放";

    playButton.setAttribute(
      "aria-pressed",
      "true"
    );

  }

  setAlphabetStatus(language, "准备播放……");

  // 直接启动第一个字母
  playNextAlphabet(taskId);

}


// ---------- 10. 逐个播放队列 ----------

function playNextAlphabet(taskId) {

  if (taskId !== alphabetTaskId) return;

  if (!alphabetIsPlaying) return;

  // 所有字母播放完成
  if (alphabetQueue.length === 0) {

    alphabetIsPlaying = false;

    clearAlphabetHighlight();

    resetAlphabetButtons();

    const language = alphabetCurrentLanguage;

    alphabetCurrentLanguage = null;

    setAlphabetStatus(language, "字母表播放完成");

    return;

  }

  const item = alphabetQueue.shift();

  const utterance = createAlphabetUtterance(
    item.language,
    item.speech
  );

  if (!utterance) {

    stopAlphabetSpeech();

    return;

  }

  // 高亮当前字母
  clearAlphabetHighlight();

  const container = document.getElementById(
    ALPHABET_CONFIG[item.language].container
  );

  if (container) {

    const buttons = container.querySelectorAll(
      ".alphabet-letter"
    );

    buttons.forEach(button => {

      if (button.textContent === item.letter) {

        alphabetCurrentButton = button;

        button.classList.add("is-speaking");

      }

    });

  }

  setAlphabetStatus(
    item.language,
    `正在朗读 ${item.letter}……`
  );

  let finished = false;

  function finishCurrentLetter() {

    if (finished) return;

    finished = true;

    if (taskId !== alphabetTaskId) return;

    clearAlphabetHighlight();

    if (!alphabetIsPlaying) return;

    // 等待当前语音结束，再启动下一条
    alphabetNextTimer = window.setTimeout(
      function () {

        alphabetNextTimer = null;

        if (taskId !== alphabetTaskId) return;

        playNextAlphabet(taskId);

      },
      350
    );

  }

  utterance.onend = finishCurrentLetter;

  utterance.onerror = function (event) {

    if (taskId !== alphabetTaskId) return;

    console.error("连续朗读失败：", event.error);

    // 用户主动停止产生的中断不再处理
    if (
      event.error === "canceled" ||
      event.error === "interrupted"
    ) {
      return;
    }

    finished = true;

    stopAlphabetSpeech();

    setAlphabetStatus(
      item.language,
      "连续朗读中断，请检查设备语音服务和语言包。"
    );

  };

  // 播放当前字母
  try {

    alphabetSynth.speak(utterance);

  } catch (error) {

    console.error("连续朗读启动失败：", error);

    stopAlphabetSpeech();

    setAlphabetStatus(
      item.language,
      "语音启动失败，请检查设备语音设置。"
    );

  }

}


// ---------- 11. 点击事件 ----------

// 单个字母
document.addEventListener("click", function (event) {

  const button = event.target.closest(
    ".alphabet-letter"
  );

  if (!button) return;

  speakSingleAlphabet(
    button.dataset.language,
    button.dataset.speak,
    button
  );

});


// 播放全部 / 停止
document.addEventListener("click", function (event) {

  const button = event.target.closest(
    "[data-play-alphabet]"
  );

  if (!button) return;

  playAlphabet(button.dataset.playAlphabet);

});


// ---------- 12. 页面切换时清理 ----------

document.addEventListener(
  "visibilitychange",
  function () {

    if (document.hidden && alphabetIsPlaying) {

      const language = alphabetCurrentLanguage;

      stopAlphabetSpeech();

      if (language) {
        setAlphabetStatus(language, "页面切换，播放已停止");
      }

    }

  }
);


window.addEventListener("pagehide", function () {

  stopAlphabetSpeech();

});


// ---------- 13. 初始化 ----------

renderAlphabet();

