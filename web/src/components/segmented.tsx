import Link from "next/link";

type Option<T> = { value: T; label: string };

/** Group of links that work as a filter: the current option is highlighted */
export function Segmented<T>({
  label,
  options,
  current,
  href,
}: {
  label: string;
  options: Option<T>[];
  current: T;
  href: (value: T) => string;
}) {
  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      <div className="segmented">
        {options.map((option) => (
          <Link
            key={option.label}
            href={href(option.value)}
            aria-current={option.value === current}
            scroll={false}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

