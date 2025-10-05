import { marked } from 'marked';

// Enable sanitization for marked to prevent XSS
marked.use({ sanitize: true, mangle: false, headerIds: false });

import { hash, compare } from 'bcrypt-ts';
import { getUserFromRequest, createJwt } from './auth';
import {
  renderWikiIndex,
  renderWikiPage,
  renderWikiEdit,
  renderLoginPage,
  renderRegisterPage,
  renderPage
} from './renderHtml';

export default {
  async fetch(request, env, ctx) {
    const { pathname, origin, searchParams } = new URL(request.url);
    const user = await getUserFromRequest(request, env);

    // --- Authentication Routes ---
    if (pathname === '/register') {
      if (request.method === 'POST') {
        const formData = await request.formData();
        const username = formData.get('username') as string;
        const password = formData.get('password') as string;

        if (!username || !password) {
          return new Response(renderRegisterPage('Username and password are required.'), { headers: { 'Content-Type': 'text/html' }, status: 400 });
        }

        const existingUser = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
        if (existingUser) {
          return new Response(renderRegisterPage('Username already taken.'), { headers: { 'Content-Type': 'text/html' }, status: 409 });
        }

        const passwordHash = await hash(password, 10);
        const { meta } = await env.DB.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').bind(username, passwordHash).run();
        
        // Log the user in immediately
        const newUserId = meta.last_row_id;
        const token = await createJwt(newUserId, env);
        const headers = new Headers({
          'Location': '/wiki',
          'Set-Cookie': `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400` // 24 hours
        });
        return new Response(null, { status: 302, headers });
      }
      return new Response(renderRegisterPage(), { headers: { 'Content-Type': 'text/html' } });
    }

    if (pathname === '/login') {
      if (request.method === 'POST') {
        const formData = await request.formData();
        const username = formData.get('username') as string;
        const password = formData.get('password') as string;

        const dbUser = await env.DB.prepare('SELECT id, password_hash FROM users WHERE username = ?').bind(username).first();
        if (!dbUser) {
          return new Response(renderLoginPage('Invalid username or password.'), { headers: { 'Content-Type': 'text/html' }, status: 401 });
        }

        const passwordMatch = await compare(password, dbUser.password_hash as string);
        if (!passwordMatch) {
          return new Response(renderLoginPage('Invalid username or password.'), { headers: { 'Content-Type': 'text/html' }, status: 401 });
        }

        const token = await createJwt(dbUser.id, env);
        const headers = new Headers({
          'Location': '/wiki',
          'Set-Cookie': `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
        });
        return new Response(null, { status: 302, headers });
      }
      return new Response(renderLoginPage(), { headers: { 'Content-Type': 'text/html' } });
    }

    if (pathname === '/logout' && request.method === 'POST') {
      const headers = new Headers({
        'Location': '/login',
        'Set-Cookie': 'auth_token=; Path=/; HttpOnly; Max-Age=0' // Expire the cookie
      });
      return new Response(null, { status: 302, headers });
    }

    // --- Wiki Routes ---
    if (pathname === '/' || pathname === '/wiki') {
      const { results } = await env.DB.prepare('SELECT slug FROM wiki_pages').all();
      return new Response(renderWikiIndex(results, user), { headers: { 'Content-Type': 'text/html' } });
    }

    if (pathname === '/wiki/new') {
      if (!user) return Response.redirect(`${origin}/login`, 302);

      if (request.method === 'POST') {
        const formData = await request.formData();
        const slug = formData.get('slug') as string;
        if (!slug) return new Response('Slug is required', { status: 400 });
        // Redirect to the edit page for the new slug
        return Response.redirect(`${origin}/wiki/${slug}/edit`, 302);
      }
      // Simple form to ask for a new page slug
      return new Response(renderPage('New Wiki Page', `
        <h1>Create a new page</h1>
        <form method="post">
          <input type="text" name="slug" placeholder="Enter new page slug" required />
          <button type="submit">Create</button>
        </form>
      `, user), { headers: { 'Content-Type': 'text/html' } });
    }

    const wikiPattern = /\/wiki\/([^\/]+)(?:\/(edit))?$/;
    const match = pathname.match(wikiPattern);

    if (!match) {
      return new Response('Not found', { status: 404 });
    }

    const slug = match[1];
    const isEditMode = match[2] === 'edit';

    if (isEditMode) {
      if (!user) return Response.redirect(`${origin}/login`, 302);

      let page = await env.DB.prepare('SELECT * FROM wiki_pages WHERE slug = ?').bind(slug).first();

      // Check permissions
      if (page && page.author_id !== user.id) {
        return new Response('You do not have permission to edit this page.', { status: 403 });
      }

      if (request.method === 'POST') {
        const formData = await request.formData();
        const content = formData.get('content') as string;
        const title = slug; // Title is the slug

        if (page) { // Update existing page
          await env.DB.prepare('UPDATE wiki_pages SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(content, page.id).run();
        } else { // Insert new page
          await env.DB.prepare('INSERT INTO wiki_pages (slug, title, content, author_id) VALUES (?, ?, ?, ?)')
            .bind(slug, title, content, user.id).run();
        }
        return Response.redirect(`${origin}/wiki/${slug}`, 302);
      }

      return new Response(renderWikiEdit(slug, page?.content as string || '', user), { headers: { 'Content-Type': 'text/html' } });
    }

    // --- View Page and Handle Comments ---
    const page = await env.DB.prepare(`
      SELECT p.*, u.username as author_username
      FROM wiki_pages p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.slug = ?
    `).bind(slug).first();

    if (!page) {
      return Response.redirect(`${origin}/wiki/${slug}/edit`, 302);
    }

    if (request.method === 'POST') { // Handle new comment
      if (!user) return Response.redirect(`${origin}/login`, 302);
      const formData = await request.formData();
      const content = formData.get('content') as string;

      // Validation: content length
      if (content.length > 100) {
        return new Response('Comment cannot exceed 100 characters.', { status: 400 });
      }

      // Validation: max comments per page
      const { count } = await env.DB.prepare('SELECT COUNT(*) as count FROM comments WHERE wiki_page_slug = ?').bind(slug).first();
      if (count >= 20) {
        return new Response('Comment limit reached for this page.', { status: 403 });
      }

      await env.DB.prepare('INSERT INTO comments (author_id, content, wiki_page_slug) VALUES (?, ?, ?)')
        .bind(user.id, content, slug).run();
      return Response.redirect(request.url, 303); // PRG pattern
    }

    const { results: comments } = await env.DB.prepare(`
      SELECT c.*, u.username as author_username
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.wiki_page_slug = ?
      ORDER BY c.id ASC
    `).bind(slug).all();

    const canEdit = user?.id === page.author_id;

    return new Response(renderWikiPage(page, comments, user, canEdit), { headers: { 'Content-Type': 'text/html' } });
  },
} satisfies ExportedHandler<Env>;
