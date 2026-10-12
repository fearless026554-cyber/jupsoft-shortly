# 🚀 JLMP Shortly - Bulk Link Creation Complete Beginner Guide
### (1 बार में 500 से 1,000+ Short Links बनाने और Tagging करने की A to Z गाइड)

---

## 📌 1. Bulk Link Creation क्या है और इसकी ज़रूरत क्यों है?

### आसान शब्दों में समझें:
मान लीजिए आपके स्कूल या कॉलेज में **1,000 बच्चे** हैं। आपको हर बच्चे के माता-पिता को SMS या WhatsApp पर उनकी फीस या रिपोर्ट कार्ड का पर्सनल लिंक भेजना है:
- **अगर आप 1-1 लिंक मैन्युअली बनाएंगे:** 1,000 लिंक्स बनाने में पूरा दिन (6-8 घंटे) लग जाएगा, और गलतियां होने का चांस बहुत ज्यादा होगा।
- **Bulk Creation के साथ:** आप सिर्फ **1 क्लिक** या एक **Excel/CSV शीट अपलोड** करके 1,000 के 1,000 लिंक्स मात्र **3 से 5 सेकंड** में बना सकते हैं!

### Bitly vs Jupsoft Shortly (JLMP) का अंतर:
| फ़ीचर | आम टूल्स (Bitly / TinyURL) | Jupsoft Shortly (JLMP) |
| :--- | :--- | :--- |
| **Batch Size Limit** | 50-100 लिंक्स (पेड प्लान में भी) | **10,000 लिंक्स** प्रति बैच |
| **TRAI DLT Whitelisting** | ❌ नहीं होता (SMS ब्लॉक हो जाते हैं) | ✅ **100% Whitelisted Domain (`go.jupsoft.com`)** |
| **Campaign Tagging** | केवल प्रीमियम में | ✅ **Unlimited Custom Tags (जैसे `#bulktest`)** |
| **Processing Speed** | 5-10 लिंक्स/सेकंड | **120+ लिंक्स/सेकंड** (Redis BullMQ Queue) |
| **Data Privacy** | थर्ड-पार्टी सर्वर पर डेटा | आपके अपने PostgreSQL + Tenant Isolation में |

---

## 🏗️ 2. सिस्टम के अंदर बैकग्राउंड में क्या होता है? (Architecture Flow)

जब आप Bulk Create बटन दबाते हैं, तो बैकग्राउंड में यह 5 स्टेप्स होते हैं:

```
[ यूजर: 1,000 लिंक्स का डेटा देता है ]
                 │
                 ▼
[ 1. Fastify / NestJS API (`POST /api/v1/links/bulk`) ]
                 │  (डेटा वैलिडेट करता है: URL सही है या नहीं)
                 ▼
[ 2. Redis BullMQ Queue (`QueueNames.BULK_LINKS`) ]
                 │  (1,000 जॉब्स को कतार में लगाता है ताकि सर्वर हैंग न हो)
                 ▼
[ 3. Background Worker (`BulkProcessor`) ]
                 │  (100-100 के बैचेस में पैरेलल काम करता है)
                 ▼
[ 4. Base58 Short Code Generator + Collision Check ]
                 │  (हर लिंक को 7-अक्षर का यूनिक कोड जैसे `go.jupsoft.com/X7k9Pq2` देता है)
                 ▼
[ 5. PostgreSQL Database Commit + Redis Cache Warmup ]
                 │
                 ▼
[ परिणाम: 1,000 लिंक्स तैयार + QR Codes + Instant Redirect ]
```

---

## 🛠️ 3. 500 से 1,000 लिंक्स बनाने के 3 सबसे आसान तरीके

### तरीका 1: Web UI Bulk Studio से (सबसे आसान - किसी कोडिंग की ज़रूरत नहीं)
1. लेफ्ट साइडबार (Rail) में **Bulk Studio** (Spreadsheet आइकन) पर क्लिक करें।
2. ऊपर दाईं तरफ पीले रंग के **"⚡ Auto-Generate Test Batch"** बटन पर क्लिक करें।
3. आपके सामने एक पॉप-अप खुलेगा:
   - **Quick Quantity**: `500 Links` या `1,000 Links` पर क्लिक करें।
   - **Campaign Tag**: अपने आप `bulktest` भरा हुआ आएगा (या अपनी पसंद का टैग लिखें)।
   - **Base Destination URL**: जैसे `https://jupsoft.com/student/portal?id=`
4. **"Populate Grid with 500 Links"** बटन दबाएं।
5. पूरी स्प्रेडशीट में 500 रोज़ तुरंत तैयार हो जाएंगी।
6. ऊपर दाईं तरफ नीले **"Dispatch Batch (500 Links)"** बटन पर क्लिक करें।
7. **काम हो गया!** 3 सेकंड में सारे लिंक्स लाइव हो जाएंगे।

---

### तरीका 2: Excel / CSV फाइल अपलोड करके
अगर आपके पास पहले से 500 या 1,000 स्टूडेंट्स का Excel डेटा है:

1. Excel या Google Sheets में यह 4 कॉलम्स बनाएं:
   ```csv
   destination_url,alias,tag,external_ref
   https://jupsoft.com/student/portal?id=STD-00001,,bulktest,BULKTEST-00001
   https://jupsoft.com/student/portal?id=STD-00002,,bulktest,BULKTEST-00002
   https://jupsoft.com/student/portal?id=STD-00003,,bulktest,BULKTEST-00003
   ```
2. इसे **`.csv` (Comma Separated Values)** फॉर्मेट में सेव करें।
3. Bulk Studio में **"Upload CSV File"** पर क्लिक करके फाइल सेलेक्ट करें।
4. सिस्टम फाइल को पढ़कर ग्रिड में लोड कर देगा।
5. **"Dispatch Batch"** दबाएं। सारे लिंक्स कतार में लगकर जनरेट हो जाएंगे।

> **💡 प्रो-टिप:** आप Bulk Studio से **"Download Ready CSV (500 Pre-filled Rows)"** पर क्लिक करके 500 पंक्तियों की तैयार CSV फाइल भी डाउनलोड कर सकते हैं।

---

### तरीका 3: ऑटोमेटेड बैकएंड स्क्रिप्ट से (डेवलपर्स और सिस्टम एडमिन के लिए)
अगर आपको टर्मिनल/कमांड प्रॉम्प्ट से एक ही कमांड में 500 या 1,000 लिंक्स बनाने हैं:

```bash
# 500 लिंक्स टैग 'bulktest' के साथ बनाने के लिए:
node scripts/generate_bulk_test_links.js 500 bulktest

# 1,000 लिंक्स बनाने के लिए:
node scripts/generate_bulk_test_links.js 1000 bulktest
```

**आउटपुट:**
```
======================================================
JLMP Shortly - Bulk Link Generation Engine
Target Count: 500 links | Tag: #bulktest
======================================================
[Config] Tenant: Jupsoft Technologies
[Config] Domain: https://go.jupsoft.com

  -> Inserted batch 1 to 100 (100 links committed)
  -> Inserted batch 101 to 200 (100 links committed)
  -> Inserted batch 201 to 300 (100 links committed)
  -> Inserted batch 301 to 400 (100 links committed)
  -> Inserted batch 401 to 500 (100 links committed)

SUCCESS: 500 Links Generated with tag 'bulktest'!
Execution Time: 3.83s (131 links/sec)
======================================================
```

---

## 🏷️ 4. Tagging क्या है और `#bulktest` से कैसे ढूंढे?

### Tagging क्यों ज़रूरी है?
जब सिस्टम में 10,000 या 50,000 लिंक्स हो जाते हैं, तो आपको यह अलग-अलग पहचानना होता है कि:
- कौन से लिंक्स **फीस कलेक्शन (`Fees`)** के थे?
- कौन से लिंक्स **एडमिशन (`Admissions`)** के थे?
- कौन से लिंक्स **टेस्टिंग (`bulktest`)** के लिए बनाए गए थे?

### Links View में फ़िल्टर कैसे करें:
1. लेफ्ट साइडबार में **Links** मेन्यू पर क्लिक करें।
2. सर्च बार के बगल में **"🏷️ All Tags"** ड्रॉपडाउन देखें।
3. ड्रॉपडाउन खोलकर **`#bulktest`** सेलेक्ट करें।
4. आपको स्क्रीन पर केवल वही लिंक्स दिखाई देंगे जो `bulktest` टैग के तहत बने हैं!
5. आप एक क्लिक में इन सभी लिंक्स को **Export CSV**, **Copy URL**, या **Archive** कर सकते हैं।

---

## ⚡ 5. हाई वॉल्यूम (1,000+ लिंक्स) पर टेक्निकल सुरक्षा

एक बिगिनर के मन में यह सवाल आ सकता है: *"अगर 1,000 लिंक्स एक साथ बनाएंगे तो क्या सिस्टम स्लो या क्रैश नहीं होगा?"*

इसका उत्तर है: **बिल्कुल नहीं!** हमने सिस्टम को इस तरह डिजाइन किया है:

1. **BullMQ Asynchronous Queue**:
   - लिंक्स बैकग्राउंड में कतार (Queue) में प्रोसेस होते हैं। यूजर इंटरफेस कभी फ्रीज़ नहीं होता।
2. **Chunked Savepoints & Database Transactions**:
   - 100-100 लिंक्स के चंक्स में डेटाबेस में सुरक्षित `SAVEPOINT` ट्रांजैक्शन होते हैं। अगर 999वें लिंक में कोई समस्या आती है, तो बाकी के 998 लिंक्स सुरक्षित रहते हैं।
3. **Base58 Collision Resistance**:
   - हर शॉर्ट कोड 7 अक्षरों का होता है (जैसे `K3m9Lp2`)। इसमें $58^7 = 2.2$ ट्रिलियन संभव कॉम्बिनेशन होते हैं। इसलिए दो लिंक्स का एक जैसा कोड बनने का चांस शून्य के बराबर होता है।
4. **Redis Multi-Layer Caching**:
   - जैसे ही लिंक बनता है, वह Redis मेमोरी कैश में स्टोर हो जाता है। जब कोई छात्र या अभिभावक उस लिंक पर क्लिक करता है, तो रीडायरेक्ट मात्र **< 2 मिलीसेकंड** में पूरा हो जाता है।

---

## ❓ 6. अक्सर पूछे जाने वाले सवाल (FAQs for Beginners)

**Q1. क्या मैं बाद में किसी लिंक का डेस्टिनेशन URL बदल सकता हूँ?**  
👉 हाँ! Links View में जाकर किसी भी लिंक के आगे **Edit** बटन दबाकर आप कभी भी उसका टारगेट URL बदल सकते हैं। शॉर्ट लिंक वही रहेगा!

**Q2. क्या बल्क लिंक्स के QR कोड्स भी अपने आप बन जाते हैं?**  
👉 हाँ! हर लिंक का यूनिक SVG और PNG QR कोड ऑटोमैटिकली जेनरेट हो जाता है, जिसे आप 1 क्लिक में डाउनलोड या प्रिंट कर सकते हैं।

**Q3. क्या मैं एक बार में 1,000 से ज्यादा लिंक्स बना सकता हूँ?**  
👉 हाँ! सिस्टम का डिफ़ॉल्ट बैच लिमिट **10,000 लिंक्स प्रति रिक्वेस्ट** है। 10,000 लिंक्स भी 40-50 सेकंड में पूरे हो जाते हैं।

**Q4. गलती से बने टेस्ट लिंक्स को कैसे हटाएं?**  
👉 Links View में जाएं, Tag फ़िल्टर में `#bulktest` चुनें, 'Select All' चेकबॉक्स दबाएं और **Batch Archive** या **Delete Permanently** पर क्लिक करें।
