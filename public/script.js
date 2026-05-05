const postsList = document.getElementById("posts-list");
const postTemplate = document.getElementById("post-template");
const commentTemplate = document.getElementById("comment-template");

const postForm = document.getElementById("post-form");
const postIdInput = document.getElementById("post-id");
const postAuthorInput = document.getElementById("post-author");
const postTitleInput = document.getElementById("post-title");
const postContentInput = document.getElementById("post-content");
const formTitle = document.getElementById("form-title");
const savePostBtn = document.getElementById("save-post-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const refreshBtn = document.getElementById("refresh-btn");

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.message || "Request failed");
  }

  if (res.status === 204) return null;
  return res.json();
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function resetForm() {
  postIdInput.value = "";
  postAuthorInput.value = "";
  postTitleInput.value = "";
  postContentInput.value = "";
  formTitle.textContent = "Create New Post";
  savePostBtn.textContent = "Publish Post";
  cancelEditBtn.hidden = true;
}

function setEditMode(post) {
  postIdInput.value = post.id;
  postAuthorInput.value = post.author;
  postTitleInput.value = post.title;
  postContentInput.value = post.content;
  formTitle.textContent = `Edit Post #${post.id}`;
  savePostBtn.textContent = "Save Changes";
  cancelEditBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showEmptyState(message) {
  postsList.innerHTML = `<div class="empty">${message}</div>`;
}

async function loadComments(postId, listEl) {
  const comments = await api(`/api/posts/${postId}/comments`);

  if (!comments.length) {
    listEl.innerHTML = `<li class="empty">No comments yet.</li>`;
    return;
  }

  listEl.innerHTML = "";

  comments.forEach((comment) => {
    const node = commentTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".comment-author").textContent = comment.author;
    node.querySelector(".comment-date").textContent = formatDate(comment.createdAt);
    node.querySelector(".comment-text").textContent = comment.content;

    node.querySelector(".delete-comment").addEventListener("click", async () => {
      if (!confirm("Delete this comment?")) return;
      await api(`/api/comments/${comment.id}`, { method: "DELETE" });
      await loadPosts();
    });

    listEl.appendChild(node);
  });
}

async function loadPosts() {
  const posts = await api("/api/posts");

  if (!posts.length) {
    showEmptyState("No posts yet. Create your first post above.");
    return;
  }

  postsList.innerHTML = "";

  for (const post of posts) {
    const node = postTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".post-title").textContent = post.title;
    node.querySelector(".post-meta").textContent = `${post.author} • ${formatDate(post.createdAt)} • ${post.commentCount} comments`;
    node.querySelector(".post-content").textContent = post.content;

    node.querySelector(".edit-post").addEventListener("click", () => {
      setEditMode(post);
    });

    node.querySelector(".delete-post").addEventListener("click", async () => {
      if (!confirm("Delete this post and all comments?")) return;
      await api(`/api/posts/${post.id}`, { method: "DELETE" });
      if (String(post.id) === postIdInput.value) resetForm();
      await loadPosts();
    });

    const commentForm = node.querySelector(".comment-form");
    const commentAuthorInput = node.querySelector(".comment-author");
    const commentContentInput = node.querySelector(".comment-content");
    const commentListEl = node.querySelector(".comment-list");

    commentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await api(`/api/posts/${post.id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          author: commentAuthorInput.value,
          content: commentContentInput.value,
        }),
      });
      commentAuthorInput.value = "";
      commentContentInput.value = "";
      await loadPosts();
    });

    await loadComments(post.id, commentListEl);
    postsList.appendChild(node);
  }
}

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    author: postAuthorInput.value,
    title: postTitleInput.value,
    content: postContentInput.value,
  };

  if (postIdInput.value) {
    await api(`/api/posts/${postIdInput.value}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  } else {
    await api("/api/posts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  resetForm();
  await loadPosts();
});

cancelEditBtn.addEventListener("click", resetForm);
refreshBtn.addEventListener("click", loadPosts);

loadPosts().catch((error) => {
  console.error(error);
  showEmptyState("Failed to load posts. Please refresh the page.");
});
