"use strict";
const PUG = require("pug");
const EXPRESS = require("express");
const BSON = require("bson");
const APP = EXPRESS();
const {
  getShops,
  checkUserBalance,
  createTransaction,
  getConfirmationByCode,
  completeTransaction,
  connectToDB
} = require("./dbManager");
const BODY_PARSER = require("body-parser");
APP.set("views", "views");
APP.set("view engine", "pug");

APP.use([BODY_PARSER.json(), BODY_PARSER.urlencoded({ extended: true })]);

APP.get("/shops/", (req, res) => {
  console.log(`APP.get("/shops/")`);
  getShops({}, (err, result) =>
    err
      ? res.status(400).send([err])
      : res.status(200).render("shops.pug", { shop: result })
  );
});

function getUrl(req, res, next) {
  console.log(req.params);
  let regex = /https:\/\/www\.(\w+)\.(\w+)/g;
  let urls = req.params["0"].match(regex);
  if (urls) {
    [req.linkInUrl] = urls;
  }
  console.log("[getUrl]", req.linkInUrl);
  next();
}

APP.get("/shops/*", getUrl, (req, res) => {
  console.log(`APP.get("/shops/*")`);
  if (req.linkInUrl) {
    getShops({ link: req.linkInUrl }, (err, result) =>
      err
        ? res.status(400).send([err])
        : res.status(200).render("shops.pug", { shop: result._doc })
    );
  } else {
    res.status(400).send("<h1>INVALID URL</h1>");
  }
});

APP.post("/shops/*/transaction", getUrl, (req, res) => {
  console.log(`APP.post("/shops/*/transaction")`);
  let userId = +req.body.userid;
  let sum = +req.body.sum;
  checkUserBalance(userId, (err, result) => {
    console.log(result, "\n doc:", result ? result._doc : "");
    err
      ? res.status(400).send([err])
      : createTransaction(
          { id: userId, link: req.linkInUrl, sum: sum },
          (err, r) => {
            err
              ? res.status(400).send([err])
              : res.status(200).render("shops.pug", {
                  shop: { link: req.linkInUrl },
                  confirm: true
                });
          }
        );
    console.log(result ? result.balance : "");
  });
});

APP.post("/shops/*/transaction/:code", getUrl, (req, res) => {
  console.log(`APP.post("/shops/*/transaction/:code")${req.params.code}`);
  getConfirmationByCode({ code: req.params.code }, (err, result) => {
    if (err) {
      res.status(400).send([err]);
    } else {
      completeTransaction(
        {
          userId: result._user,
          link: req.linkInUrl,
          transactionId: result._transaction,
          code: req.params.code
        },
        (err, r) => {
          err
            ? res.status(400).send([err])
            : res.status(200).render("shops.pug", {
                transactionCompleted: "Transaction completed"
              });
        }
      );
    }
  });
});

APP.listen(3000, () => {
  console.log("Listening on port", 3000);
  connectToDB();
});
