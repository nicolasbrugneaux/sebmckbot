import bodyParser from "body-parser";
import request from "request";
import express from "express";
import path from "path";
import fs from "fs";

var templates = {};

for (var file of fs.readdirSync(`${__dirname}/templates`)) {
  var name = path.basename(file, path.extname(file));
  templates[name] = fs.readFileSync(`${__dirname}/templates/${file}`, "utf8");
}


class Bot {
  constructor(username, password) {
    this.username = username;
    this.password = password;
  }

  isQuestion(event) {
    return event.issue.title.endsWith("?") || event.issue.title.includes("question");
  }

  isDocumentation(event) {
    return event.issue.title.includes("docs") || event.issue.title.includes("documentation") || event.issue.title.includes("website");
  }

  async request(method, url, body) {
    await new Promise((resolve, reject) => {
      console.log("Hitting", url, "with method", method, "and body", body);
      request({
        auth: {
          username: this.username,
          password: this.password
        },
        method: method,
        url: `https://api.github.com/${url}`,
        body: body
      }, function (err, res, body) {
        if (err) {
          reject(err);
        } else {
          resolve(body);
        }
      });
    });
  }

  async closeIssue(event, action) {
    await this.commentIssue(event, action);
    await this.request("PATCH", `/repos/${event.repository.full_name}/issues/${event.issue.id}`, {
      state: "closed"
    });
  }

  async commentIssue(event, action) {
    await this.request("POST", `/repos/${event.repository.full_name}/issues/${event.issue.id}/comments`, {
      body: templates[action]
    });
  }

  async onEvent(event) {
    if (!event.repository || !event.sender) return;

    if (event.issue && event.action === "opened") {
      if (this.isQuestion(event)) {
        await this.closeIssue(event, "question");
      }

      if (this.isDocumentation(event)) {
        await this.closeIssue(event, "docs");
      }
    }
  }
}

var bot = new Bot(process.env.GITHUB_USERNAME, process.env.GITHUB_PASSWORD);

var app = express();

app.use(bodyParser.json());

app.all("/", function (req, res) {
  res.end();

  console.log(req.body);

  bot.onEvent(req.body).then(function (data) {
    console.log(data);
  }, function (err) {
    console.error(err.stack);
  });
});

console.log(process.env);

app.listen(process.env.PORT, function () {
  console.log("Listening...");
});
