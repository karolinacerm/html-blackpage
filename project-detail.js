(() => {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('id');

  const article = document.querySelector('[data-project]');
  const emptyState = document.querySelector('[data-empty-state]');

  if (!article || !emptyState) {
    console.error('Project template chybí v project.html');
    return;
  }

  function refreshAOS() {
    if (!window.AOS) return;
    if (!window.__aosReady) {
      window.AOS.init({
        duration: 400,
        easing: 'ease-out-quad',
        once: true,
        disableMutationObserver: true
      });
      window.__aosReady = true;
      return;
    }
    window.AOS.refreshHard();
  }

  function setupDeferredVideo(video) {
    video.preload = 'none';
    video.autoplay = false;

    const startVideo = () => {
      if (video.dataset.started === 'true') return;
      video.dataset.started = 'true';
      video.preload = 'metadata';
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    };

    if (!('IntersectionObserver' in window)) {
      startVideo();
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        startVideo();
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '200px 0px' });

    observer.observe(video);
  }

  const getField = name => article.querySelector(`[data-field="${name}"]`);
  const getBlock = name => article.querySelector(`[data-block="${name}"]`);

  function normalizeMarkdown(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value.map(normalizeMarkdown).filter(Boolean).join('\n\n');
    }
    if (typeof value === 'object') {
      if (value.body !== undefined) return normalizeMarkdown(value.body);
      if (value.text !== undefined) return normalizeMarkdown(value.text);
      if (value.copy !== undefined) return normalizeMarkdown(value.copy);
      if (value.paragraph !== undefined) return normalizeMarkdown(value.paragraph);
      if (value.value !== undefined) return normalizeMarkdown(value.value);
    }
    return '';
  }

  function renderMarkdown(container, markdown, { inline = false } = {}) {
    const source = normalizeMarkdown(markdown);
    if (!source) return false;
    const marked = window.marked;
    if (marked && typeof marked === 'object') {
      if (inline && typeof marked.parseInline === 'function') {
        container.innerHTML = marked.parseInline(source);
      } else if (typeof marked.parse === 'function') {
        container.innerHTML = marked.parse(source);
      } else {
        container.textContent = source;
      }
    } else {
      container.textContent = source;
    }
    return container.innerHTML !== '' || container.textContent !== '';
  }

  function parseProjects(data) {
    if (!data) return [];
    if (Array.isArray(data.projects)) return data.projects;
    if (Array.isArray(data)) return data;
    return [];
  }

  function parseInlineData(text, fallback = '[]') {
    const source = (text || '').trim();
    if (!source) {
      return JSON.parse(fallback);
    }
    return JSON.parse(source);
  }

  async function fetchProjects(src) {
    const res = await fetch(src, { cache: 'default' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const projects = parseProjects(payload);
    if (!projects.length) {
      throw new Error('Projects data is empty');
    }
    return projects;
  }

  function renderDetails(details) {
    const container = getField('details');
    if (!container) return;
    if (!details || typeof details !== 'object') {
      container.remove();
      return;
    }

    const entries = Object.entries(details).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    });

    if (!entries.length) {
      container.remove();
      return;
    }

    container.innerHTML = '';
    entries.forEach(([label, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = Array.isArray(value) ? value.join(' · ') : value;
      container.appendChild(dt);
      container.appendChild(dd);
    });
  }

function createFigure(src, alt) {
  const figure = document.createElement('figure');
  figure.className = 'block block--image';
  figure.setAttribute('data-aos', 'fade-up');

  const img = document.createElement('img');
  img.src = src;
  img.alt = alt || '';
  figure.appendChild(img);
  return figure;
}

  function createVideo(src, alt, poster) {
  const figure = document.createElement('figure');
  figure.className = 'block block--image';
  figure.setAttribute('data-aos', 'fade-up');

  const video = document.createElement('video');
  video.src = src;

  video.controls = false;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.preload = 'metadata';

  video.setAttribute('disablePictureInPicture', '');
  video.setAttribute('disableremoteplayback', '');

  if (poster) {
    video.poster = poster;
  }
  if (alt) {
    video.setAttribute('aria-label', alt);
    video.title = alt;
  }

  video.style.pointerEvents = 'none';

  figure.appendChild(video);
  return figure;
}

  function isVideoSource(src) {
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(src || '');
  }

  function renderGoal(goal) {
    const block = getBlock('goal');
    const body = getField('goal');
    if (!block || !body) return;
    if (!renderMarkdown(body, goal)) {
      block.remove();
      return;
    }
    block.hidden = false;
  }

  function renderYear(year) {
    const block = getBlock('year');
    const body = getField('year');
    if (!block || !body) return;
    const value = (year === 0 || year) ? String(year).trim() : '';
    if (!value) {
      block.remove();
      return;
    }
    body.textContent = value;
    block.hidden = false;
  }

  function renderNav(projects, currentIndex) {
    const nav = getBlock('nav');
    if (!nav) return;

    const list = Array.isArray(projects) ? projects : [];
    if (list.length < 2 || currentIndex < 0) {
      nav.remove();
      return;
    }

    const prevEl = getField('prev');
    const nextEl = getField('next');
    const total = list.length;
    const prev = list[(currentIndex - 1 + total) % total];
    const next = list[(currentIndex + 1) % total];

    const applyLink = (el, project) => {
      if (!el) return;
      if (!project || !project.id) {
        el.remove();
        return;
      }
      el.href = `./project.html?id=${encodeURIComponent(project.id)}`;
      if (project.title) el.title = project.title;
    };

    applyLink(prevEl, prev);
    applyLink(nextEl, next);
    nav.hidden = false;
  }

  function renderContent(blocks) {
    const wrapper = getField('content');
    if (!wrapper) return;
    if (!Array.isArray(blocks) || !blocks.length) {
      wrapper.remove();
      return;
    }

    wrapper.innerHTML = '';
    blocks.forEach(block => {
      if (!block || typeof block !== 'object') return;
      const type = (block.type || '').toLowerCase();
      const textValue =
        block.body ??
        block.text ??
        block.copy ??
        block.description ??
        block.value ??
        block.content ??
        '';
      const hasText = normalizeMarkdown(textValue).trim().length > 0;
      const imageSrc = block.src || block.image;
      const videoSrc = block.video || (isVideoSource(imageSrc) ? imageSrc : '');
      const alt = block.alt || '';
      const poster = block.videoImage || block.poster || '';

      if ((type === 'video' || (!hasText && videoSrc)) && videoSrc) {
        const video = createVideo(videoSrc, alt, poster);
        wrapper.appendChild(video);
        return;
      }

      if ((type === 'image' || (!hasText && imageSrc && !isVideoSource(imageSrc))) && imageSrc && !isVideoSource(imageSrc)) {
        const figure = createFigure(imageSrc, alt);
        wrapper.appendChild(figure);
        return;
      }

      if ((type === 'videoimage') && videoSrc) {
        const combo = document.createElement('div');
        combo.className = 'block block--text-image';
        if (hasText) {
          const textBlock = document.createElement('div');
          textBlock.className = 'block block--text';
          if (renderMarkdown(textBlock, textValue)) {
            combo.appendChild(textBlock);
          }
        }
        const video = createVideo(videoSrc, alt, poster);
        combo.appendChild(video);
        wrapper.appendChild(combo);
        return;
      }

      if ((type === 'textimage' || type === 'textimgae' || (hasText && imageSrc && !isVideoSource(imageSrc))) && imageSrc && !isVideoSource(imageSrc)) {
        const combo = document.createElement('div');
        combo.className = 'block block--text-image';
        if (hasText) {
          const textBlock = document.createElement('div');
          textBlock.className = 'block block--text';
          if (renderMarkdown(textBlock, textValue)) {
            combo.appendChild(textBlock);
          }
        }
        const figure = createFigure(imageSrc, alt);
        combo.appendChild(figure);
        wrapper.appendChild(combo);
        return;
      }

      if (!hasText) return;
      const textBlock = document.createElement('div');
      textBlock.className = 'block block--text';

      // Přidání animace pro text
      textBlock.setAttribute('data-aos', 'fade-up');

      if (renderMarkdown(textBlock, textValue)) {
        wrapper.appendChild(textBlock);
      }
    });

    if (!wrapper.children.length) {
      wrapper.remove();
    }
  }

  function renderLinks(links) {
    const block = getBlock('links');
    const list = block ? block.querySelector('[data-field="links"]') : null;
    if (!block || !list) return;

    if (!Array.isArray(links) || !links.length) {
      block.remove();
      return;
    }

    list.innerHTML = '';
    links.forEach(link => {
      if (!link?.url) return;
      const anchor = document.createElement('a');
      anchor.href = link.url;
      anchor.textContent = link.label || link.url;
      if (/^https?:\/\//i.test(link.url)) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
      list.appendChild(anchor);
    });
    block.hidden = false;
  }

  function setupStaticAside() {
    const aside = document.querySelector('.project-aside');
    const main = document.querySelector('.project-main');
    if (!aside || !main) return;

    const desktop = window.matchMedia('(min-width: 900px)');
    let ticking = false;

    // Position the fixed column so it lines up with the top of the content,
    // but always stays fully inside the viewport (so PREVIOUS/NEXT is never
    // clipped). On short windows it moves up and, only if it still can't fit,
    // scrolls internally.
    const alignTop = () => {
      if (!desktop.matches) {
        aside.style.top = '';
        aside.style.maxHeight = '';
        return;
      }
      const margin = 24;
      const header = document.querySelector('header');
      const minTop = (header ? Math.round(header.getBoundingClientRect().height) : 120) + 16;
      const contentTop = Math.round(main.getBoundingClientRect().top + window.pageYOffset);

      // Measure the column's natural height (without the max-height clamp).
      const prevMax = aside.style.maxHeight;
      aside.style.maxHeight = 'none';
      const asideH = aside.offsetHeight;
      aside.style.maxHeight = prevMax;

      const fitTop = window.innerHeight - asideH - margin;
      const top = Math.max(minTop, Math.min(contentTop, fitTop));
      aside.style.top = top + 'px';
      aside.style.maxHeight = Math.max(160, window.innerHeight - top - margin) + 'px';
    };

    // Hide the fixed column once the footer scrolls up, so it never overlaps it.
    const update = () => {
      ticking = false;
      if (!desktop.matches) {
        aside.classList.remove('is-hidden');
        return;
      }
      const stoppers = ['#contact', '.footer-visual', '.footer']
        .map(sel => document.querySelector(sel))
        .filter(Boolean);
      const limit = aside.getBoundingClientRect().bottom + 24;
      const reached = stoppers.some(el => el.getBoundingClientRect().top < limit);
      aside.classList.toggle('is-hidden', reached);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    const onResize = () => {
      alignTop();
      update();
    };

    alignTop();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    // Re-align after the header/footer partials and images settle.
    window.addEventListener('load', onResize);
    [150, 500, 1200].forEach(delay => setTimeout(onResize, delay));
    if (typeof desktop.addEventListener === 'function') {
      desktop.addEventListener('change', onResize);
    }
  }

  function renderProject(project, projects, currentIndex) {
    if (!project) {
      article.hidden = true;
      emptyState.hidden = false;
      return;
    }

    document.title = `${project.title} — Karolina C Design`;

    const titleEl = getField('title');
    if (titleEl) titleEl.textContent = project.title || 'Project';

    const metaEl = getField('meta');
    if (metaEl) {
      const tagList = Array.isArray(project.tags) ? project.tags.filter(Boolean) : [];
      const meta = tagList.length ? `/ ${tagList.join(', ')}` : '';
      if (meta) {
        metaEl.textContent = meta;
      } else {
        metaEl.remove();
      }
    }

    renderGoal(project.goal);
    renderYear(project.year);
    renderDetails(project.details || project.meta);

    const info = article.querySelector('.project-info');
    if (info && !info.children.length) info.remove();

    renderNav(projects, typeof currentIndex === 'number' ? currentIndex : -1);
    renderContent(project.content);
    renderLinks(project.links);

    article.hidden = false;
    emptyState.hidden = true;

    setupStaticAside();

    // INICIALIZACE / REFRESH AOS
    requestAnimationFrame(() => {
      refreshAOS();
    });
  }

  async function init() {
    if (!projectId) {
      renderProject(null);
      return;
    }

    const src = './projects.json';
    const inline = document.getElementById('projects-data');

    try {
      const projects = await fetchProjects(src);
      const index = projects.findIndex(item => item.id === projectId);
      renderProject(index >= 0 ? projects[index] : null, projects, index);
    } catch (err) {
      console.warn('Fetch project selhal, zkusím inline data:', err);
      if (inline) {
        try {
          const text = inline.textContent || '';
          const fallback = parseInlineData(text, '[]');
          const projects = parseProjects(fallback);
          const index = projects.findIndex(item => item.id === projectId);
          renderProject(index >= 0 ? projects[index] : null, projects, index);
          return;
        } catch (parseErr) {
          console.error('Inline data má chybný formát:', parseErr);
        }
      }
      renderProject(null);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
