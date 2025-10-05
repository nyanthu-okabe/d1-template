import { marked } from "marked";

// Common styles for all pages
const globalStyles = `
  body {
      background-color: #f0f0f0;
      font-family: "MS PGothic", "IPAMonaPGothic", "Mona", sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #000;
      margin: 0;
      padding: 0;
  }
  .container {
      width: 80%;
      max-width: 1100px;
      margin: 20px auto;
      padding: 20px;
      background-color: #fff;
      border: 1px solid #ccc;
      border-radius: 8px;
  }
  h1, h2, h3, h4, h5, h6 {
      color: #800000;
      padding: 10px 0;
      margin: 0;
      font-family: "MS PGothic", "IPAMonaPGothic", "Mona", sans-serif;
  }
  a { text-decoration: none; color: #0000ee; }
  a:hover { text-decoration: underline; color: #ee0000; }
  pre { background: #1e1e1e; color: #dcdcdc; padding: 12px; border-radius: 6px; overflow-x: auto; }
  img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; }
  button, input[type="submit"] { background-color: #800000; border: 1px solid #800000; padding: 10px 20px; cursor: pointer; font-weight: bold; color: white; transition: 0.15s; border-radius: 4px; }
  button:hover, input[type="submit"]:hover { background-color: #600000; }
  input[type="text"], input[type="password"], textarea {
    width: calc(100% - 22px);
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: inherit;
    font-size: inherit;
    margin-bottom: 10px;
  }
  .navbar { background-color: #800000; padding: 10px 20px; color: white; display: flex; justify-content: space-between; align-items: center; }
  .navbar a { color: white; margin: 0 10px; }
  .navbar .user-info { color: #f0f0f0; }
  .error { color: red; border: 1px solid red; padding: 10px; margin-bottom: 10px; border-radius: 4px; }
`;

/**
 * Renders the full page with a common navbar and layout.
 * @param title The title of the page.
 * @param content The main HTML content of the page.
 * @param user The currently logged-in user object, or null.
 */
export function renderPage(
  title: string,
  content: string,
  user: { username: string } | null,
) {
  const navLinks = user
    ? `
        <span class="user-info">Welcome, ${user.username}</span>
        <a href="/wiki/new">New Page</a>
        <form action="/logout" method="post" style="display: inline;"><button type="submit">Logout</button></form>
      `
    : `
        <a href="/login">Login</a>
        <a href="/register">Register</a>
      `;

  return `
    <!DOCTYPE html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title} - Wiki</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
        <style>${globalStyles}</style>
      </head>
      <body>
        <nav class="navbar">
          <div><a href="/wiki"><strong>nythu.wiki</strong></a></div>
          <div>${navLinks}</div>
        </nav>
        <div class="container">
          ${content}
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
      </body>
    </html>
  `;
}

// --- Page-specific renderers ---

export function renderWikiIndex(pages: { slug: string }[], user: any) {
  const content = `
    <h1>nythu.wiki</h1>
    <ul>
      ${pages.map((page) => `<li><a href="/wiki/${page.slug}">${page.slug}</a></li>`).join("")}
    </ul>
  `;
  return renderPage("nythu.wiki", content, user);
}

export function renderWikiPage(
  page: any,
  comments: any[],
  user: any,
  canEdit: boolean,
) {
  const editButton = canEdit
    ? `<a href="/wiki/${page.slug}/edit">Edit this page</a>`
    : "";
  const commentForm = user
    ? `
      <form method="POST">
        <h3>Leave a comment</h3>
        <textarea name="content" placeholder="Your comment (Markdown supported)" required></textarea>
        <br>
        <button type="submit">Submit</button>
      </form>
    `
    : `<p><a href="/login">Log in</a> to leave a comment.</p>`;

  const content = `
    <h1>${page.title}</h1>
    <small>Created by ${page.author_username || "Unknown"}</small>
    <hr>
    <div>${marked(page.content)}</div>
    <br>
    ${editButton}
    <hr>
    <h2>Comments</h2>
    <div id="comments">
      ${comments.map((c) => `<p><strong>${c.author_username}:</strong> ${marked(c.content)}</p>`).join("")}
    </div>
    ${commentForm}
  `;
  return renderPage(page.title, content, user);
}

export function renderWikiEdit(title: string, pageContent: string, user: any) {
  const content = `
    <h1>Editing: ${title}</h1>
    <form method="POST" id="edit-form">
      <div id="editor-container" style="height: 600px; border: 1px solid #ccc;"></div>
      <textarea name="content" id="content-textarea" style="display: none;"></textarea>
      <br>
      <button type="submit">Save</button>
    </form>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.33.0/min/vs/loader.min.js"></script>
    <script>
      require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.33.0/min/vs' }});
      require(['vs/editor/editor.main'], function() {
        const initialContent = ${JSON.stringify(pageContent)};
        const editor = monaco.editor.create(document.getElementById('editor-container'), {
          value: initialContent,
          language: 'markdown',
          theme: 'vs-dark'
        });
        const form = document.getElementById('edit-form');
        const textarea = document.getElementById('content-textarea');
        form.addEventListener('submit', function(e) {
          textarea.value = editor.getValue();
        });
      });
    </script>
  `;
  return renderPage(`Editing: ${title}`, content, user);
}

export function renderLoginPage(error?: string) {
  const errorHtml = error ? `<div class="error">${error}</div>` : "";
  const content = `
    <h1>Login</h1>
    ${errorHtml}
    <form method="POST">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" required>
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required>
      <button type="submit">Login</button>
    </form>
    <p>Don't have an account? <a href="/register">Register here</a>.</p>
  `;
  return renderPage("Login", content, null);
}

export function renderRegisterPage(error?: string) {
  const errorHtml = error ? `<div class="error">${error}</div>` : "";
  const content = `
    <h1>Register</h1>
    ${errorHtml}
    <form method="POST">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" required>
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required>
      <button type="submit">Register</button>
    </form>
    <p>Already have an account? <a href="/login">Login here</a>.</p>
  `;
  return renderPage("Register", content, null);
}
