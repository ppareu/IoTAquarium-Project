const express = require("express");
const { SerialPort } = require("serialport");
const nunjucks = require("nunjucks");
const dotenv = require("dotenv");
const path = require("path");
const morgan = require("morgan");
const { sequelize, FeedSetting } = require("./models");

// const { FeedSetting } = require("./models");

const app = express();

const MainRouter = require("./routes/main");
const feedRouter = require("./routes/feed");
dotenv.config();

/*==============================================
 파일 액세스 허용
==============================================*/
app.set("port", process.env.PORT || 3000);
app.set("view engine", "html"); // 넉적슨 임포팅 부분
nunjucks.configure("views", {
  express: app,
  watch: true,
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/views/main.html"));
});

/*==============================================
 아두이노 시리얼 포트 설정
==============================================*/
const arduinoCOMPort = "/dev/ttyACM0";
const com1 = new SerialPort({
  path: arduinoCOMPort,
  baudRate: 9600,
  // defaults for Arduino serial communication
  dataBits: 8,
  parity: "none",
  stopBits: 1,
  flowControl: false,
});

com1.on("open", function () {
  console.log("open serial communication");
  console.log("http://localhost:3000/");
});

/*==============================================
 시퀄라이즈 DB 설정
==============================================*/
sequelize
  .sync({ force: false })
  .then(() => {
    console.log("데이터베이스 연결 성공");
  })
  .catch((err) => {
    console.error(err);
  });

app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "css")));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/*==============================================
 아두이노 FEED 먹이 전송
==============================================*/
app.post("/feed", async (req, res) => {
  const { feedCount, hour, minute } = req.body;
  const dataString = `FEED ${feedCount} TIME ${hour}:${minute}\n`;

  com1.write(dataString, async function (err) {
    if (err) {
      return console.log("Error on write: ", err.message);
    }
    console.log("Message sent complete");
    console.log(dataString);

    try {
      const newSetting = await FeedSetting.create({
        feed_count: feedCount,
        hour: hour,
        minute: minute,
      });
      console.log("new Setting value success : ", newSetting);
      res.status(200).send("Value save success");
    } catch (error) {
      console.error("new Setting value error :", error);
      res.status(500).send("Value save error");
    }
  });
});

/*==============================================
 Html 라우팅
==============================================*/
app.use("/main", MainRouter);
app.use("/feed", feedRouter);

app.use((req, res, next) => {
  const error = new Error(`${req.method} ${req.url} 라우터가 없습니다.`);
  error.status = 404;
  next(error);
});

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = process.env.NODE_ENV !== "production" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

app.get("/feed/:id", function (req, res) {
  console.log(req.params.id);
  com1.write(req.params.id);
  res.status(200).send("FEED Controll OK!!");
});

app.listen(app.get("port"), () => {
  console.log(app.get("port"), "번 포트에서 대기 중");
});
