# Posting through Make.com (while Pinterest reviews the app)

PinFlow can post through Make.com's own Pinterest connection until your Pinterest app is approved.
When you later tap **Connect Pinterest** in PinFlow's Settings, PinFlow switches to direct posting by itself and stops calling Make.

**Cost:** Make's Free plan (1,000 credits a month). PinFlow uses about **3 credits per pin** and about **4 each time boards are loaded**. At 2 pins a day that's roughly 200 credits a month. If Make ever asks for payment, stop and check with Claude first.

**Tip:** build the scenarios on a computer. Make's editor is hard to use on a phone.

You'll build two small scenarios. Each one starts with a webhook (a private web address PinFlow sends data to).

---

## Part 1 — Create the two webhooks and send their addresses

1. Sign up at **make.com** (free) and connect your Pinterest **business** account when asked.
2. **Create a new scenario.** Click the big **+**, search **Webhooks**, choose **Custom webhook**.
   - Click **Add**, name it `PinFlow post`, click **Save**.
   - Click **Copy address to clipboard**. Save it somewhere.
   - Name the scenario `PinFlow – Post pin` (top left) and click **Save** (the disk icon at the bottom).
3. **Create a second new scenario** the same way, with a Custom webhook named `PinFlow boards`. Copy its address too.
   - Name this scenario `PinFlow – Boards` and save.
4. **Send both addresses to Claude**, saying which is "post" and which is "boards". Claude saves them in Vercel. After about 2 minutes, PinFlow's **Settings → Make.com bridge** shows them as saved.

## Part 2 — Teach Make what PinFlow sends

Do this in one scenario at a time.

5. Open the scenario and click **Run once** (bottom left). Make starts waiting for data.
6. In PinFlow, open **Settings → Make.com bridge** and tap **Send setup samples**.
7. Back in Make, a small bubble appears on the webhook circle. Make has learned the data. Click **Save**.
8. Repeat steps 5 to 7 in the other scenario.
   (Samples carry a dummy key, so they never post anything. "Redetermine data structure" only appears after this first run, so you don't need it.)

## Part 3 — Finish the "Post pin" scenario

7. After the webhook, add **Pinterest → Create a Pin** and pick your Pinterest connection. Fill in:
   - **Board:** switch the field to **Map**, then pick `board_id` from the webhook data.
   - **Title:** `title`
   - **Description:** `description`
   - **Link:** `link`
   - **Alt text:** `alt_text` (if the field exists)
   - **Media / Source type:** **Image URL**, and for the URL pick `image_url`
8. Click the line between the webhook and Pinterest, choose **Set up a filter**:
   - Label: `Correct key`
   - Condition: pick `key` from the webhook, choose **Text operators: Equal to**, and paste the **Security key** shown in PinFlow's Settings.
9. After Create a Pin, add **Webhooks → Webhook response**:
   - **Status:** `200`
   - **Body:** pick the pin's **ID** from Create a Pin (just the ID, nothing else).
10. Click **Save**, then turn the scenario **ON** (scheduling: *Immediately as data arrives*).

## Part 4 — Finish the "Boards" scenario

11. After the webhook, add the same **filter** as step 8.
12. Add **Pinterest → List Boards** (same connection). Set Limit to `100` if asked.
13. Add **Tools → Text aggregator**:
    - **Source module:** List Boards
    - **Row separator:** New row
    - **Text:** pick the board's `ID`, type a `|` (vertical bar), then pick the board's `Name`. It should look like `ID|Name`.
14. Add **Webhooks → Webhook response**: Status `200`, Body = the aggregator's **Text**.
15. **Save** and turn the scenario **ON**.

## Part 5 — Check it works

16. In PinFlow **Settings → Make.com bridge**, tap **Load boards**. You should see "Loaded N boards".
17. Create a pin, pick a board, and tap **Post now**. It should show **Posted** in the Queue with a **View pin** link.

If a pin shows **Failed**, the message says what happened. Make's scenario **History** shows the details.
