// A tiny reactive core: signals, computed values, effects, and a DOM morpher.
// Effects re-run (batched per microtask) whenever a signal they read changes,
// and mount() morphs the new markup into the page so focus/inputs survive.

let current = null;
const queue = new Set();
let scheduled = false;

function track(subs) {
  if (current) {
    subs.add(current);
    current.deps.add(subs);
  }
}

function trigger(subs) {
  for (const sub of [...subs]) sub.notify();
}

function cleanup(node) {
  for (const dep of node.deps) dep.delete(node);
  node.deps.clear();
}

function flush() {
  while (queue.size) {
    const [node] = queue;
    queue.delete(node);
    try {
      node.run();
    } catch (err) {
      console.error(err);
    }
  }
  scheduled = false;
}

export function signal(initial) {
  let value = initial;
  const subs = new Set();
  return {
    get value() {
      track(subs);
      return value;
    },
    set value(next) {
      if (Object.is(next, value)) return;
      value = next;
      trigger(subs);
    },
    peek: () => value,
  };
}

export function computed(fn) {
  let value;
  let dirty = true;
  const subs = new Set();
  const node = {
    deps: new Set(),
    notify() {
      if (dirty) return;
      dirty = true;
      trigger(subs);
    },
  };
  return {
    get value() {
      track(subs);
      if (dirty) {
        cleanup(node);
        const prev = current;
        current = node;
        try {
          value = fn();
          dirty = false;
        } finally {
          current = prev;
        }
      }
      return value;
    },
  };
}

export function effect(fn) {
  const node = {
    deps: new Set(),
    run() {
      cleanup(node);
      const prev = current;
      current = node;
      try {
        fn();
      } finally {
        current = prev;
      }
    },
    notify() {
      queue.add(node);
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    },
  };
  node.run();
  return () => {
    cleanup(node);
    queue.delete(node);
  };
}

// ---------- templating ----------

class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (s) => s.replace(/[&<>"']/g, (c) => ESC[c]);

function toHtml(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(toHtml).join('');
  return escape(String(v));
}

/** Tagged template: interpolations are escaped unless they're nested html``. */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => {
    out += toHtml(v) + strings[i + 1];
  });
  return new Raw(out);
}

export const raw = (s) => new Raw(s);

// ---------- DOM morphing ----------

export function morph(target, markup) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(markup ?? '');
  patchChildren(target, tpl.content);
}

function sameNode(a, b) {
  return (
    a.nodeType === b.nodeType &&
    a.nodeName === b.nodeName &&
    (a.nodeType !== 1 || a.getAttribute('data-key') === b.getAttribute('data-key'))
  );
}

function patchChildren(parent, next) {
  const oldKids = [...parent.childNodes];
  const newKids = [...next.childNodes];
  newKids.forEach((nk, i) => {
    const ok = oldKids[i];
    if (!ok) parent.appendChild(nk);
    else if (!sameNode(ok, nk)) parent.replaceChild(nk, ok);
    else patchNode(ok, nk);
  });
  for (let i = newKids.length; i < oldKids.length; i++) oldKids[i].remove();
}

function patchNode(a, b) {
  if (a.nodeType !== 1) {
    if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
    return;
  }
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);

  const focused = document.activeElement === a;
  if (a.nodeName === 'TEXTAREA') {
    if (!focused && a.value !== b.textContent) a.value = b.textContent;
    return;
  }
  // Only "controlled" inputs (rendered with a value attribute) get their value synced.
  if (a.nodeName === 'INPUT' && b.hasAttribute('value') && !focused && a.value !== b.getAttribute('value')) {
    a.value = b.getAttribute('value');
  }
  patchChildren(a, b);
}

/** Re-render `view()` into `el` whenever anything it reads changes. */
export function mount(el, view) {
  return effect(() => morph(el, view()));
}
