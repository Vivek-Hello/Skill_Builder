// Profile picture with an initial as fallback
export function Avatar({ url, name, size = 24 }: { url: string | null; name: string; size?: number }) {
  const style = { width: size, height: size };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from many hosts (GitHub, Gravatar)
    return <img src={url} alt="" style={style} className="shrink-0 rounded-full bg-panel-2 object-cover" />;
  }
  return (
    <span
      style={{ ...style, fontSize: size * 0.45 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent uppercase"
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  );
}

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
export const formatDate = (iso: string) => DATE.format(new Date(iso));
