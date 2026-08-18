import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

/**
 * Pre-process wire markdown before rendering:
 * - Lines like `**1. Title** *(tag)*` → `### 1. Title *(tag)*`
 *   so react-markdown gives us a clean h3 we can style as a lead header.
 * - Lines starting with `**This Issue at a Glance**` → `#### This Issue at a Glance`
 * - Lines starting with `Source:` get a special marker prefix so we can style them.
 */
function preprocess(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      // Numbered lead: **1. Foo** *(tag)* or **1. Foo**
      if (/^\*\*\d+\./.test(line)) {
        // Strip the outer ** wrapping the number+title portion
        // **1. Title** *(tag)* → ### 1. Title *(tag)*
        return line.replace(/^\*\*(\d+\..+?)(\*\*)(.*)$/, "### $1$3");
      }
      // "This Issue at a Glance" section label
      if (/^\*\*This Issue at a Glance\*\*/.test(line)) {
        return "#### This Issue at a Glance";
      }
      return line;
    })
    .join("\n");
}

/**
 * Renders the weekly Wire markdown draft with Playfair Display typography,
 * bold numbered leads, and clean section spacing.
 */
export function WireRenderer({ markdown }: { markdown: string }) {
  const processed = preprocess(markdown);

  const components: Components = {
    // # Hollywood Sales Wire
    h1({ children }) {
      return (
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground mb-0.5">
          {children}
        </h1>
      );
    },

    // ## Tuesday, August 19, 2026
    h2({ children }) {
      return (
        <h2 className="font-serif text-base font-normal text-muted-foreground mb-5 italic">
          {children}
        </h2>
      );
    },

    // ### 1. Numbered lead header (converted from **1. ...**)
    h3({ children }) {
      return (
        <h3 className="font-serif text-[1.05rem] font-extrabold text-foreground mt-6 mb-2 leading-snug border-l-[3px] border-primary pl-3 tracking-tight">
          {children}
        </h3>
      );
    },

    // #### This Issue at a Glance
    h4({ children }) {
      return (
        <h4 className="font-sans text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mt-4 mb-1">
          {children}
        </h4>
      );
    },

    // Body paragraphs
    p({ children }) {
      // Detect "Source:" lines by converting children to string
      const text = childrenToString(children);
      if (text.trimStart().startsWith("Source:") || text.includes("[SINGLE SOURCE")) {
        return (
          <p className="font-sans text-[0.7rem] text-muted-foreground mt-1 mb-4 break-all leading-snug">
            {children}
          </p>
        );
      }
      return (
        <p className="font-serif text-[0.88rem] leading-[1.65] text-foreground mb-2">
          {children}
        </p>
      );
    },

    // Bold — field labels (WHO:, WHAT HAPPENED:, etc.) and inline emphasis
    strong({ children }) {
      return <strong className="font-bold text-foreground">{children}</strong>;
    },

    em({ children }) {
      return <em className="italic text-muted-foreground">{children}</em>;
    },

    // Horizontal rule between items
    hr() {
      return <hr className="my-5 border-t border-border/50" />;
    },

    // Bullet lists (glance bullets, watch list)
    ul({ children }) {
      return <ul className="my-1.5 space-y-1 pl-0 list-none">{children}</ul>;
    },

    li({ children }) {
      return (
        <li className="font-serif text-[0.85rem] leading-relaxed text-foreground flex gap-2.5 items-start">
          <span className="mt-[0.55em] shrink-0 w-[5px] h-[5px] rounded-full bg-primary/50" />
          <span>{children}</span>
        </li>
      );
    },

    // Links in source lines
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-70 break-all"
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="bg-background border border-border px-7 py-6 max-h-[560px] overflow-y-auto">
      <ReactMarkdown components={components}>{processed}</ReactMarkdown>
    </div>
  );
}

/** Flatten React children to a plain string for pattern detection. */
function childrenToString(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(childrenToString).join("");
  if (children && typeof children === "object" && "props" in (children as object)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return childrenToString((children as any).props?.children);
  }
  return "";
}
