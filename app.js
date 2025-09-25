// Pricing note: Flux Schnell costs vary by provider. Here, users generate images via Websim's image API at no cost to them.

const { useEffect, useMemo, useRef, useState, useSyncExternalStore } = React;

const room = new WebsimSocket();
const COLLECTION = 'gallery_post_v1';

function useRecords(collection) {
  const subscribe = useMemo(() => room.collection(collection).subscribe, []);
  const getList = useMemo(() => room.collection(collection).getList, []);
  return useSyncExternalStore(subscribe, getList) || [];
}

function useCurrentUser() {
  const [user, setUser] = useState(null);
  useEffect(() => { (async () => setUser(await window.websim.getCurrentUser()))(); }, []);
  return user;
}

function App() {
  const posts = useRecords(COLLECTION);
  const user = useCurrentUser();
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('id');
    if (id) setHighlightId(id);
  }, []);

  useEffect(() => {
    if (!highlightId) return;
    const el = document.querySelector(`[data-id="${highlightId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight');
      setTimeout(() => el.classList.remove('highlight'), 2600);
    }
  }, [posts, highlightId]);

  return (
    <div>
      <header className="header">
        <div>
          <div className="brand">Flux Schnell Gallery</div>
          <div className="note">Generate images for free here and share instantly.</div>
        </div>
        <div className="note">
          <span className="kbd">Mobile ready</span>
        </div>
      </header>
      <Generator user={user} />
      <Gallery posts={posts} currentUser={user} />
    </div>
  );
}

function Generator({ user }) {
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState('1:1');
  const [seed, setSeed] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(null);

  useEffect(() => () => clearInterval(progressRef.current), []);

  async function generate() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setProgress(0);

    // Show ~10s progress while imageGen runs
    let elapsed = 0;
    clearInterval(progressRef.current);
    progressRef.current = setInterval(() => {
      elapsed += 250;
      const p = Math.min(100, Math.round((elapsed / 10000) * 100));
      setProgress(p);
    }, 250);

    try {
      const args = { prompt: prompt.trim(), aspect_ratio: aspect };
      if (seed.trim()) args.seed = Number(seed.trim()) || undefined;

      const result = await websim.imageGen(args);
      const url = result.url;

      await room.collection(COLLECTION).create({
        prompt: prompt.trim(),
        aspect_ratio: aspect,
        seed: seed.trim() || null,
        image_url: url,
      });

      setPrompt('');
      setSeed('');
    } catch (e) {
      alert('Generation failed. Please try again.');
      console.error(e);
    } finally {
      clearInterval(progressRef.current);
      setProgress(100);
      setTimeout(() => setBusy(false), 300);
      setTimeout(() => setProgress(0), 800);
    }
  }

  return (
    <section className="form" aria-label="generator">
      <div className="row">
        <input
          type="text"
          placeholder="Describe anything…"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          aria-label="Prompt"
        />
        <select value={aspect} onChange={e => setAspect(e.target.value)} aria-label="Aspect ratio">
          <option value="1:1">1:1</option>
          <option value="4:5">4:5</option>
          <option value="3:4">3:4</option>
          <option value="2:3">2:3</option>
          <option value="3:2">3:2</option>
          <option value="4:3">4:3</option>
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
          <option value="21:9">21:9</option>
          <option value="9:21">9:21</option>
        </select>
        <input
          type="text"
          placeholder="Seed (optional)"
          value={seed}
          onChange={e => setSeed(e.target.value)}
          aria-label="Seed"
        />
        <button className="btn" onClick={generate} disabled={!prompt.trim() || busy}>
          {busy ? 'Generating…' : 'Generate'}
        </button>
      </div>
      {busy && (
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div style={{ width: `${progress}%` }} />
        </div>
      )}
    </section>
  );
}

function Gallery({ posts, currentUser }) {
  // posts are newest->oldest per docs
  if (!posts.length) {
    return <div className="empty">No images yet. Be the first to create something!</div>;
  }
  return (
    <section className="gallery" aria-label="gallery">
      {posts.map(p => (
        <Card key={p.id} post={p} currentUser={currentUser} />
      ))}
    </section>
  );
}

function Card({ post, currentUser }) {
  const isOwner = currentUser && post.username === currentUser.username;

  async function handleDelete() {
    if (!confirm('Delete this post?')) return;
    try {
      await room.collection(COLLECTION).delete(post.id);
    } catch (e) {
      alert('Delete failed. You can only delete your own posts.');
    }
  }

  function copyLink() {
    const url = `${window.baseUrl}?id=${post.id}`;
    navigator.clipboard.writeText(url);
  }

  function download() {
    // simple download by opening the image URL
    window.open(post.image_url, '_blank');
  }

  return (
    <article className="card" data-id={post.id}>
      <img className="thumb" src={post.image_url} alt={post.prompt} loading="lazy" />
      <div className="meta">
        <div className="prompt">{post.prompt}</div>
        <div className="user">
          <img src={`https://images.websim.com/avatar/${post.username}`} alt="" />
          <span>@{post.username}</span>
          <span className="badge">• {post.aspect_ratio || '1:1'}</span>
          {post.seed ? <span className="badge">• seed {post.seed}</span> : null}
        </div>
        <div className="actions">
          <button className="icon" onClick={copyLink}>Share</button>
          <button className="icon" onClick={download}>Open</button>
          {isOwner && <button className="icon" onClick={handleDelete}>Delete</button>}
        </div>
      </div>
    </article>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<App />);

