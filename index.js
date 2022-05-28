const path = require("path");
const fs = require("fs");
const express = require("express");
const app = express();
const formidable = require("formidable");
const { v4 } = require("uuid");
const { MongoClient, ObjectId } = require("mongodb");
const PORT = process.env.PORT || 5000;

const uri = process.env.MONGODB_URI;

app.use(express.static("public"));

app.use((req, res, next) => {
  const matcher = /(\/seg\/)|(\/form\/)|(\/suggestion\/)|(\/suggestion)/gi;
  if (req.url.match(matcher)) {
    res.end(fs.readFileSync("./public/index.html", { encoding: "utf-8" }));
  }
  next();
});

async function logError(error) {
  return new Promise(async (resolve, reject) => {
    const client = new MongoClient(uri);
    try {
      await client.connect();
      await client
        .db("sem-4-ref")
        .collection("error")
        .insertOne({ error: error });
    } catch (error) {
      console.log(error);
    } finally {
      await client.close();
      resolve(true);
    }
  });
}

app.get("/api/main", async function (req, res) {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const cursor = client.db("sem-4-ref").collection("seg").find();
    const result = await cursor.toArray();
    res.json(result);
  } catch (error) {
    await logError(error);
    res.redirect("/");
  } finally {
    await client.close();
  }
});

app.get("/api/segment/:segId", async function (req, res) {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const cursor = client
      .db("sem-4-ref")
      .collection("subSeg")
      .find({ segId: req.params.segId });
    const result = await cursor.toArray();
    const segTitle = await client
      .db("sem-4-ref")
      .collection("seg")
      .findOne({ _id: ObjectId(req.params.segId) });
    res.json({ title: segTitle["title"], data: result });
  } catch (error) {
    await logError(error);
    res.redirect("/");
  } finally {
    await client.close();
  }
});

app.post("/post/newSuggestion", async function (req, res) {
  let formData = new formidable.IncomingForm();
  formData.parse(req, async function (err, fields, files) {
    if (err) {
      console.log(err);
    }
    const client = new MongoClient(uri);
    try {
      await client.connect();
      const result = await client
        .db("sem-4-ref")
        .collection("suggestion")
        .insertOne({ name: fields["name"], suggestion: fields["suggestion"] });
      res.end(JSON.stringify({ status: "ok" }));
    } catch (error) {
      await logError(error);
      res.redirect("/");
    } finally {
      client.close();
    }
  });
});

app.post("/post/addForm/:submitTier", async function (req, res) {
  const submitTier = req.params.submitTier;
  let formData = new formidable.IncomingForm();
  formData.parse(req, async function (err, fields, files) {
    if (err) {
      console.log(err);
    }
    const client = new MongoClient(uri);
    try {
      if (Number(submitTier) === 1) {
        await client.connect();
        const result = await client
          .db("sem-4-ref")
          .collection("seg")
          .insertOne({ title: fields["segTitle"] });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ segId: result["insertedId"] }));
      } else if (Number(submitTier) === 2) {
        await client.connect();
        await client.db("sem-4-ref").collection("subSeg").insertOne({
          segId: fields["segId"],
          title: fields["subSegTitle"],
          links: [],
        });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status: "OK" }));
      } else if (Number(submitTier) === 3) {
        let url;
        console.log(fields["subSegId"]);
        if (files.hasOwnProperty("refFile")) {
          let uuid = v4();
          const oldpath = files.refFile.filepath;
          const newpath =
            "./public/uploads/" +
            uuid +
            path.extname(files.refFile.originalFilename);
          fs.renameSync(oldpath, newpath);
          url =
            "../uploads/" + uuid + path.extname(files.refFile.originalFilename);
        } else {
          url = fields["refUri"];
        }
        await client.connect();
        await client
          .db("sem-4-ref")
          .collection("subSeg")
          .updateOne(
            { _id: ObjectId(fields["subSegId"]) },
            {
              $push: {
                links: { title: fields["refTitle"], url: url },
              },
            }
          );
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status: "OK" }));
      }
    } catch (error) {
      await logError(error);
      res.redirect("/");
    } finally {
      client.close();
    }
  });
});

app.post("/error", async (req, res) => {
  let formData = new formidable.IncomingForm();
  formData.parse(req, async (err, fields, files) => {
    if (err) {
      console.log(err);
    }
    await logError(fields.error);
    res.end(JSON.stringify({ status: "OK" }));
  });
});

app.listen(PORT, () => {
  console.log(`Listning on port ${PORT}`);
});
