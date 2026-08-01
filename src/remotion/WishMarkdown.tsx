import type {ReactNode} from "react";

type ListItem = {text: string; children: ListItem[]};

export function WishMarkdown({markdown}: {markdown: string}) {
  const items = parseList(markdown);
  return <div className="video-wish-markdown"><List items={items} /></div>;
}

function List({items}: {items: ListItem[]}) {
  return <ul>{items.map((item, index) => <li key={`${item.text}-${index}`}>
    <InlineMarkdown text={item.text} />
    {item.children.length ? <List items={item.children} /> : null}
  </li>)}</ul>;
}

function InlineMarkdown({text}: {text: string}) {
  const parts: ReactNode[] = [];
  const pattern = /~~([^~]+)~~/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(<del key={`${index}-${match[1]}`}>{match[1]}</del>);
    cursor = index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function parseList(markdown: string): ListItem[] {
  const root: ListItem[] = [];
  const lists: ListItem[][] = [root];
  let previous: ListItem | undefined;

  for (const rawLine of markdown.split("\n")) {
    if (!rawLine.trim()) continue;
    const match = rawLine.match(/^(\s*)[-*+]\s+(.+)$/);
    const text = match?.[2] ?? rawLine.trim();
    const depth = match ? Math.floor(match[1].replaceAll("\t", "  ").length / 2) : 0;
    const safeDepth = Math.min(depth, lists.length);

    while (lists.length > safeDepth + 1) lists.pop();
    if (safeDepth >= lists.length && previous) {
      lists.push(previous.children);
    }
    const target = lists[Math.min(safeDepth, lists.length - 1)];
    const item = {text, children: []};
    target.push(item);
    previous = item;
  }
  return root;
}
