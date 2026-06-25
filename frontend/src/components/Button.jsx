export default function Button({ variant = "primary", children, ...props }) {
  const base = "w-full py-[13px] rounded-[11px] font-semibold text-[15px] font-sans transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-accent text-white hover:bg-accent-hover",
    outline: "border border-accent text-accent-text hover:bg-accent-soft",
  };

  return (
    <button className={`${base} ${variants[variant]}`} {...props}>
      {children}
    </button>
  );
}
