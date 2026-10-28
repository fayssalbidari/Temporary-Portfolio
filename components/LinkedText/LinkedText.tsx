import type { ReactNode } from "react";

// Transforme "[label](url)" en liens. Seuls http, https et mailto sont acceptés.
export default function LinkedText({
  text,
  linkClassName,
}: {
  text: string;
  linkClassName?: string;
}) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const linkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;

  while ((match = linkPattern.exec(text))) {
    const [full, label, href] = match;
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (/^(https?:|mailto:)/i.test(href)) {
      const external = href.startsWith("http");
      nodes.push(
        <a
          key={match.index}
          className={linkClassName}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {label}
        </a>,
      );
    } else {
      nodes.push(label);
    }
    last = match.index + full.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}
