"use strict";
const MONGOOSE = require("mongoose");

function connectToDB() {
  MONGOOSE.connect(
    "mongodb://localhost:27017/cashBack",
    {
      useNewUrlParser: true
    },
    (err, res) => (err ? console.log(err) : console.log("Connected to DB."))
  ).then(() => fillDB());
}
MONGOOSE.set("useFindAndModify", false);
const USER_MODEL = MONGOOSE.model("User", { userid: Number, balance: Number });
const SHOP_MODEL = MONGOOSE.model("Shop", {
  link: String,
  name: String,
  balance: Number
});
const TRANSACTION_MODEL = MONGOOSE.model("Transaction", {
  _user: { type: MONGOOSE.Types.ObjectId, ref: "User" },
  _shop: { type: MONGOOSE.Types.ObjectId, ref: "Shop" },
  created: Date,
  sumTransaction: Number
});
const CONFIRMATION_MODEL = MONGOOSE.model("Confirmation", {
  _user: { type: MONGOOSE.Types.ObjectId, ref: "User" },
  _transaction: { type: MONGOOSE.Types.ObjectId, ref: "Transaction" },
  code: String,
  status: Number
});

function fillDB() {
  try {
    USER_MODEL.collection.drop((err, res) =>
      err
        ? console.log("users: ", err.codeName)
        : console.log("Dropped 'users'.", res)
    );
    SHOP_MODEL.collection.drop((err, res) =>
      err
        ? console.log("shops: ", err.codeName)
        : console.log("Dropped 'shops'.", res)
    );
    TRANSACTION_MODEL.collection.drop((err, res) =>
      err
        ? console.log("transactions: ", err.codeName)
        : console.log("Dropped 'transactions'.", res)
    );
    CONFIRMATION_MODEL.collection.drop((err, res) =>
      err
        ? console.log("confirmations: ", err.codeName)
        : console.log("Dropped 'confirmations'.", res)
    );
  } catch (error) {
    console.log("Error dropping collections: ", error);
  }
  const SAMPLE_SHOP_1 = new SHOP_MODEL({
    link: "https://www.ebay.com",
    name: "ebay",
    balance: 1000000
  });
  const SAMPLE_SHOP_2 = new SHOP_MODEL({
    link: "https://www.amazon.com",
    name: "amazon",
    balance: 2000000
  });
  const SAMPLE_SHOP_3 = new SHOP_MODEL({
    link: "https://www.olx.ua",
    name: "olx",
    balance: 1000000
  });
  const SAMPLE_SHOP_4 = new SHOP_MODEL({
    link: "https://prom.ua",
    name: "prom",
    balance: 500000
  });
  const SAMPLE_USER = new USER_MODEL({ userid: 1, balance: 1000 });
  SAMPLE_USER.save().then(() => console.log("SAMPLE_USER saved"));
  SAMPLE_SHOP_1.save().then(() => console.log("SAMPLE_SHOP_1 saved"));
  SAMPLE_SHOP_2.save().then(() => console.log("SAMPLE_SHOP_2 saved"));
  SAMPLE_SHOP_3.save().then(() => console.log("SAMPLE_SHOP_3 saved"));
  SAMPLE_SHOP_4.save().then(() => console.log("SAMPLE_SHOP_4 saved"));
}

function checkUserBalance(userid, callback) {
  USER_MODEL.findOne({ userid: userid })
    .select({ _id: 0, balance: 1 })
    .exec((err, result) =>
      err ? callback(err, null) : callback(null, result)
    );
}

function getShops(options, callback) {
  let bool = "link" in options;
  SHOP_MODEL.find(bool ? { link: options.link } : {})
    .select({ _id: 0, link: 1, name: 1, balance: 1 })
    .exec((err, result) => {
      if (err) callback(err, null);
      callback(null, bool ? result[0] : result);
    });
}

async function createTransaction(options, callback) {
  const { id, link, sum } = options;
  let userId = await USER_MODEL.findOne({ userid: id }).select({ _id: 1 });
  let shopId = await SHOP_MODEL.findOne({ link: link }).select({ _id: 1 });
  if (!userId || !shopId) {
    callback("User or Shop is invalid", null);
  }
  let randCode = [...Array(6)]
    .map(i => (~~(Math.random() * 36)).toString(36))
    .join("");
  let newTransaction = new TRANSACTION_MODEL({
    _user: userId,
    _shop: shopId,
    created: new Date(),
    sumTransaction: sum
  });
  let newConfirmation = new CONFIRMATION_MODEL({
    _user: userId,
    _transaction: newTransaction._id,
    code: randCode,
    status: 0
  });
  newTransaction.save().then(() =>
    console.log(`Transaction: \n\
    ${newTransaction} saved.`)
  );
  newConfirmation.save().then(() =>
    console.log(`Confirmation: \n\
    ${newConfirmation} saved.`)
  );
  callback(null, null);
  console.log(`[createTransaction] newTransaction: ${newTransaction} \n \
                                   newConfirmation: ${newConfirmation}`);
}

function getConfirmationByCode(options, callback) {
  CONFIRMATION_MODEL.find({ code: options.code }, (err, res) => {
    if (err) {
      callback(err, null);
    } else if (!res.length) {
      callback("Invalid code", null);
    } else {
      callback(null, res[0]);
    }
  });
}

async function completeTransaction(options, callback) {
  const { userId, link, transactionId, code } = options;
  console.log("transactionId: ", transactionId);

  let transactionSum = await TRANSACTION_MODEL.findById(transactionId).select({
    _id: 0,
    sumTransaction: 1
  });
  console.log("transactionSum: ", transactionSum);

  USER_MODEL.findOne({ _id: userId })
    .select({
      _id: 0,
      balance: 1
    })
    .exec((err, res) => {
      USER_MODEL.findOneAndUpdate(
        { _id: userId },
        { balance: (res.balance -= transactionSum.sumTransaction) },
        (err, res) => (err ? console.log(err) : console.log(res))
      );
    });
  SHOP_MODEL.findOne({ link: link })
    .select({
      _id: 0,
      balance: 1
    })
    .exec((err, res) => {
      SHOP_MODEL.findOneAndUpdate(
        { link: link },
        { balance: (res.balance += transactionSum.sumTransaction) },
        (err, res) => (err ? console.log(err) : console.log(res))
      );
    });
  await CONFIRMATION_MODEL.findOneAndUpdate(
    { code: code },
    { status: 1 },
    (err, res) => (err ? callback(err, null) : callback(null, res))
  );
}

module.exports = {
  checkUserBalance,
  getShops,
  createTransaction,
  getConfirmationByCode,
  completeTransaction,
  connectToDB
};
