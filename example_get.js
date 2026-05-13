const { Firestore } = require("@google-cloud/firestore");
const db = new Firestore();

exports.getAhorro = async (req, res) => {
  // ✅ CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    const snapshot = await db.collection("ahorro").get();

    if (snapshot.empty) {
      return res.status(200).json({ success: true, data: null });
    }

    const doc = snapshot.docs[0];

    res.status(200).json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
Ñ;
