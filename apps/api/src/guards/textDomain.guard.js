const { normalizeText } = require("../utils/text");

const OUT_OF_DOMAIN_KEYWORDS = [
  // Lập trình / code
  "sua code",
  "fix code",
  "debug",
  "bug",
  "loi code",
  "code loi",
  "code python",
  "python",
  "javascript",
  "typescript",
  "java",
  "c++",
  "c#",
  "php",
  "html",
  "css",
  "react",
  "vue",
  "angular",
  "nodejs",
  "node js",
  "express",
  "nestjs",
  "fastapi",
  "django",
  "flask",
  "spring boot",
  "lap trinh",
  "viet ham",
  "viet code",
  "source code",
  "api",
  "backend",
  "frontend",
  "database",
  "sql",
  "mysql",
  "postgresql",
  "mongodb",
  "qdrant",
  "chroma",
  "docker",
  "github",
  "git",
  "terminal",
  "npm",
  "pip",
  "server",
  "localhost",

  // Toán / bài tập
  "bai toan",
  "giai toan",
  "phuong trinh",
  "bat phuong trinh",
  "dao ham",
  "tich phan",
  "hinh hoc",
  "dai so",
  "xac suat",
  "thong ke",
  "ma tran",
  "vector toan",
  "logarit",
  "can bac",
  "giai bai tap",
  "lam bai tap",
  "dap an",
  "de thi",
  "kiem tra",
  "trac nghiem",

  // Thiết bị / công nghệ cá nhân
  "laptop",
  "may tinh",
  "pc",
  "dien thoai",
  "iphone",
  "samsung",
  "xiaomi",
  "oppo",
  "vivo",
  "ipad",
  "tablet",
  "tai nghe",
  "ban phim",
  "chuot",
  "man hinh",
  "card do hoa",
  "cpu",
  "gpu",
  "ram",
  "ssd",
  "mainboard",
  "pin laptop",
  "sac dien thoai",
  "wifi",
  "router",

  // Bóng đá / thể thao
  "messi",
  "ronaldo",
  "neymar",
  "mbappe",
  "haaland",
  "bong da",
  "lich thi dau",
  "ket qua bong da",
  "world cup",
  "euro",
  "ngoai hang anh",
  "premier league",
  "champions league",
  "real madrid",
  "barcelona",
  "manchester united",
  "man city",
  "arsenal",
  "liverpool",
  "chelsea",
  "bayern",
  "psg",
  "bong ro",
  "nba",
  "bong chuyen",
  "cau long",
  "tennis",

  // Tài chính / đầu tư
  "chung khoan",
  "co phieu",
  "trai phieu",
  "crypto",
  "bitcoin",
  "ethereum",
  "coin",
  "altcoin",
  "nft",
  "forex",
  "vang",
  "gia vang",
  "usd",
  "ty gia",
  "lai suat",
  "ngan hang",
  "vay tien",
  "dau tu",
  "loi nhuan",
  "thi truong tai chinh",

  // Sức khỏe / y tế
  "benh",
  "trieu chung",
  "thuoc",
  "kham benh",
  "bac si",
  "noi mac tu cung",
  "mang thai",
  "thu que",
  "dau bung",
  "dau dau",
  "sot",
  "cam cum",
  "nam da",
  "mun",
  "giam can",
  "tang can",
  "an kieng",
  "gym",
  "tap bung",
  "suc khoe",
  "tam ly",
  "stress",
  "tram cam",

  // Tình cảm / đời sống cá nhân
  "nguoi yeu",
  "ban trai",
  "ban gai",
  "chia tay",
  "yeu don phuong",
  "tan gai",
  "tan trai",
  "crush",
  "hen ho",
  "ngoai tinh",
  "fwb",
  "ons",
  "hon nhan",
  "vo chong",
  "gia dinh",
  "ban be",
  "sinh nhat",
  "loi chuc",
  "viet thu tinh cam",

  // Tử vi / tâm linh
  "tu vi",
  "la so",
  "cung hoang dao",
  "sao han",
  "phong thuy",
  "boi bai",
  "tarot",
  "van menh",
  "duyen am",
  "kiep truoc",
  "nghiep",
  "tam linh",
  "giai mong",

  // Game / giải trí
  "game",
  "lien quan",
  "free fire",
  "pubg",
  "valorant",
  "league of legends",
  "lol",
  "roblox",
  "minecraft",
  "genshin",
  "steam",
  "mod game",
  "nap game",
  "phim",
  "anime",
  "truyen tranh",
  "manga",
  "nhac",
  "bai hat",
  "loi bai hat",
  "ca si",
  "dien vien",

  // Học tập / môn học không phải du lịch
  "ngu van",
  "van hoc",
  "dia ly",
  "vat ly",
  "hoa hoc",
  "sinh hoc",
  "tieng anh",
  "ngu phap",
  "viet doan van",
  "viet bai van",
  "thuyet trinh",
  "tieu luan",
  "bao cao",
  "powerpoint",
  "slide",
  "word",
  "excel",

  // Pháp luật / chính trị / xã hội chung
  "phap luat",
  "luat",
  "kien tung",
  "hop dong",
  "chinh tri",
  "dang",
  "nha nuoc",
  "bau cu",
  "chien tranh",
  "quan doi",
  "cong an",
  "quoc phong",
  "tin tuc",
  "thoi su",

  // Mua bán / thương mại không liên quan du lịch
  "mua laptop",
  "mua dien thoai",
  "gia laptop",
  "gia dien thoai",
  "ban hang",
  "kinh doanh",
  "marketing",
  "quang cao",
  "shop",
  "don hang",
  "shopee",
  "lazada",
  "tiki",
  "mua online",

  // Nội dung chung không thuộc du lịch
  "nau an",
  "mon an hom nay",
  "cong thuc nau an",
  "sua xe",
  "xe may",
  "oto",
  "bang lai xe",
  "thoi tiet",
  "du bao thoi tiet"
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasOutOfDomainKeyword(normalizedText) {
  return OUT_OF_DOMAIN_KEYWORDS.some((keyword) => {
    const pattern = escapeRegExp(keyword).replace(/\s+/g, "\\s+");
    const regex = new RegExp(`(^|\\s)${pattern}(\\s|$|[.,!?;:])`, "i");

    return regex.test(normalizedText);
  });
}

class TextDomainGuard {
  check(message, context = {}) {
    const normalized = normalizeText(message);

    if (!normalized) {
      return {
        allowed: false,
        status: "error",
        error_code: "EMPTY_INPUT",
        message: "Please provide a message.",
      };
    }

    if (hasOutOfDomainKeyword(normalized)) {
      return this.outOfScope();
    }

    return {
      allowed: true,
      is_follow_up: Boolean(
        context.active_location_id ||
          context.active_location_name ||
          (Array.isArray(context.last_returned_images) &&
            context.last_returned_images.length > 0),
      ),
    };
  }

  outOfScope() {
    return {
      allowed: false,
      status: "out_of_scope",
      error_code: "TEXT_NOT_TRAVEL_RELATED",
      message:
        "Mình chỉ hỗ trợ các câu hỏi liên quan đến địa điểm du lịch ở Việt Nam. Bạn có thể hỏi về địa điểm, hoạt động, thông tin tham quan hoặc ảnh du lịch.",
    };
  }
}

const textDomainGuard = new TextDomainGuard();

module.exports = {
  TextDomainGuard,
  hasOutOfDomainKeyword,
  textDomainGuard,
};
