const express = require("express");
const path = require("path");
const { initDb } = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function mapPost(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    author: row.author || "Anonymous",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    commentCount: row.comment_count ?? 0,
  };
}

function mapComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    author: row.author || "Anonymous",
    content: row.content,
    createdAt: row.created_at,
  };
}

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/posts", async (_req, res) => {
  try {
    const db = await initDb();
    const rows = await db.all(`
      SELECT p.*, COUNT(c.id) AS comment_count
      FROM posts p
      LEFT JOIN comments c ON c.post_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    res.json(rows.map(mapPost));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch posts." });
  }
});

app.get("/api/posts/:id", async (req, res) => {
  try {
    const db = await initDb();
    const row = await db.get(
      `
      SELECT p.*, COUNT(c.id) AS comment_count
      FROM posts p
      LEFT JOIN comments c ON c.post_id = p.id
      WHERE p.id = ?
      GROUP BY p.id
    `,
      [req.params.id]
    );

    if (!row) {
      return res.status(404).json({ message: "Post not found." });
    }

    res.json(mapPost(row));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch post." });
  }
});

app.post("/api/posts", async (req, res) => {
  const { title, content, author } = req.body;

  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ message: "Title and content are required." });
  }

  try {
    const db = await initDb();
    const result = await db.run(
      `
      INSERT INTO posts (title, content, author)
      VALUES (?, ?, ?)
    `,
      [title.trim(), content.trim(), author?.trim() || "Anonymous"]
    );

    const post = await db.get("SELECT * FROM posts WHERE id = ?", [result.lastID]);
    res.status(201).json(mapPost({ ...post, comment_count: 0 }));
  } catch (error) {
    res.status(500).json({ message: "Failed to create post." });
  }
});

app.put("/api/posts/:id", async (req, res) => {
  const { title, content, author } = req.body;

  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ message: "Title and content are required." });
  }

  try {
    const db = await initDb();
    const existing = await db.get("SELECT * FROM posts WHERE id = ?", [req.params.id]);

    if (!existing) {
      return res.status(404).json({ message: "Post not found." });
    }

    await db.run(
      `
      UPDATE posts
      SET title = ?, content = ?, author = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [
        title.trim(),
        content.trim(),
        author?.trim() || "Anonymous",
        req.params.id,
      ]
    );

    const updated = await db.get(
      `
      SELECT p.*, COUNT(c.id) AS comment_count
      FROM posts p
      LEFT JOIN comments c ON c.post_id = p.id
      WHERE p.id = ?
      GROUP BY p.id
    `,
      [req.params.id]
    );

    res.json(mapPost(updated));
  } catch (error) {
    res.status(500).json({ message: "Failed to update post." });
  }
});

app.delete("/api/posts/:id", async (req, res) => {
  try {
    const db = await initDb();
    const result = await db.run("DELETE FROM posts WHERE id = ?", [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Post not found." });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Failed to delete post." });
  }
});

app.get("/api/posts/:id/comments", async (req, res) => {
  try {
    const db = await initDb();
    const comments = await db.all(
      "SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC",
      [req.params.id]
    );
    res.json(comments.map(mapComment));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch comments." });
  }
});

app.post("/api/posts/:id/comments", async (req, res) => {
  const { author, content } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ message: "Comment content is required." });
  }

  try {
    const db = await initDb();
    const post = await db.get("SELECT id FROM posts WHERE id = ?", [req.params.id]);

    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    const result = await db.run(
      `
      INSERT INTO comments (post_id, author, content)
      VALUES (?, ?, ?)
    `,
      [req.params.id, author?.trim() || "Anonymous", content.trim()]
    );

    const comment = await db.get("SELECT * FROM comments WHERE id = ?", [result.lastID]);
    res.status(201).json(mapComment(comment));
  } catch (error) {
    res.status(500).json({ message: "Failed to add comment." });
  }
});

app.delete("/api/comments/:id", async (req, res) => {
  try {
    const db = await initDb();
    const result = await db.run("DELETE FROM comments WHERE id = ?", [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Comment not found." });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Failed to delete comment." });
  }
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ message: "Unexpected server error." });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
