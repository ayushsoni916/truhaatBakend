/**
 * MLM E2E TEST
 * - SubAdmin is CREATED MANUALLY
 * - Script starts BELOW SubAdmin
 * - 2 users per level
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API = "http://localhost:4000/api";
const OUTPUT = path.join(__dirname, "mlm-e2e-output.json");

const SUBADMIN_REFERRAL = "TRUZVD02W";
const OTP = "111111";
const BASE_PHONE = 8000000000;
const DELAY = 3000;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const save = data => fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2));

async function sendOtp(phone) {
  await axios.post(`${API}/auth/send-otp`, { phone });
  await sleep(DELAY);
}

async function signup(phone, referralCode) {
  const v = await axios.post(`${API}/auth/verify-otp`, { phone, code: OTP });
  await sleep(DELAY);

  const s = await axios.post(`${API}/auth/signup`, {
    signupToken: v.data.signupToken,
    phone,
    firstName: `U${phone.slice(-4)}`,
    lastName: "Test",
    gender: "Male",
    referralCode
  });
  await sleep(DELAY);

  return s.data;
}

async function buy(token, planId) {
  await axios.post(
    `${API}/plans/purchase`,
    { planId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  await sleep(DELAY);
}

async function wallet(token) {
  const w = await axios.get(`${API}/wallet`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const h = await axios.get(`${API}/wallet/history`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return { wallet: w.data, history: h.data };
}

(async function run() {
  console.log("\n🚀 MLM TEST STARTED\n");

  const out = {
    startedAt: new Date().toISOString(),
    subadminReferral: SUBADMIN_REFERRAL,
    levels: []
  };

  // Fetch USER plan
  const plans = await axios.get(`${API}/plans`);
  const plan = plans.data.plans[0];

  let parents = [SUBADMIN_REFERRAL];
  let phoneCounter = BASE_PHONE;

  for (let level = 1; level <= 10; level++) {
    console.log(`--- LEVEL ${level} ---`);
    const nextParents = [];

    for (const parentReferral of parents) {
      for (let i = 0; i < 2; i++) {
        phoneCounter++;
        const phone = String(phoneCounter);

        const node = { level, phone, parentReferral };

        try {
          await sendOtp(phone);
          const user = await signup(phone, parentReferral);
          await buy(user.token, plan._id);

          const w = await wallet(user.token);

          node.user = user.user;
          node.wallet = w.wallet;
          node.history = w.history;

          nextParents.push(user.user.referralCode);
          out.levels.push(node);
          save(out);

          console.log(`✅ ${phone} created`);
        } catch (e) {
          node.error = e.response?.data || e.message;
          out.levels.push(node);
          save(out);
          throw e;
        }
      }
    }

    parents = nextParents;
    console.log(`✔ Level ${level} done\n`);
  }

  out.finishedAt = new Date().toISOString();
  save(out);

  console.log("\n🎉 MLM TEST COMPLETED\n");
})().catch(err => {
  console.error("\n❌ TEST FAILED");
  console.error(err.message);
});
