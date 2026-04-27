import {
  AlertCircle,
  BriefcaseBusiness,
  FileText,
  Inbox,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";
import "./Primitives.css";

const joinClassNames = (...classes) => classes.filter(Boolean).join(" ");

export const PageHeader = ({
  eyebrow,
  title,
  description,
  actions,
  className,
}) => (
  <header className={joinClassNames("ui-page-header", className)}>
    <div className="ui-page-header-copy">
      {eyebrow && <span className="ui-eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="ui-page-header-actions">{actions}</div>}
  </header>
);

export const SurfaceCard = ({ children, className, as: Component = "section" }) => (
  <Component className={joinClassNames("ui-surface-card", className)}>
    {children}
  </Component>
);

export const Button = ({
  children,
  className,
  icon: Icon,
  variant = "secondary",
  size = "md",
  to,
  type = "button",
  ...props
}) => {
  const Component = to ? Link : "button";
  const componentProps = to ? { to, ...props } : { type, ...props };

  return (
    <Component
      className={joinClassNames("ui-button", `variant-${variant}`, `size-${size}`, className)}
      {...componentProps}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      <span>{children}</span>
    </Component>
  );
};

export const StatCard = ({ icon: Icon = BriefcaseBusiness, value, label, tone = "brand" }) => (
  <SurfaceCard className="ui-stat-card">
    <span className={`ui-stat-icon tone-${tone}`}>
      <Icon size={20} aria-hidden="true" />
    </span>
    <span className="ui-stat-value">{value}</span>
    <span className="ui-stat-label">{label}</span>
  </SurfaceCard>
);

export const DataCard = ({
  eyebrow,
  title,
  description,
  meta,
  actions,
  children,
  className,
  as = "article",
}) => (
  <SurfaceCard className={joinClassNames("ui-data-card", className)} as={as}>
    <div className="ui-data-card-header">
      <div>
        {eyebrow && <span className="ui-eyebrow">{eyebrow}</span>}
        {title && <h3>{title}</h3>}
        {description && <p>{description}</p>}
      </div>
      {meta && <div className="ui-data-card-meta">{meta}</div>}
    </div>
    {children && <div className="ui-data-card-body">{children}</div>}
    {actions && <div className="ui-data-card-actions">{actions}</div>}
  </SurfaceCard>
);

export const EmptyState = ({
  icon: Icon = Inbox,
  title = "No records found",
  description,
  action,
}) => (
  <div className="ui-empty-state">
    <span className="ui-empty-icon">
      <Icon size={32} aria-hidden="true" />
    </span>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {action && <div className="ui-empty-action">{action}</div>}
  </div>
);

export const Skeleton = ({ className }) => (
  <span className={joinClassNames("ui-skeleton", className)} aria-hidden="true" />
);

export const SearchBar = ({ className, ...props }) => (
  <label className={joinClassNames("ui-search-bar", className)}>
    <Search size={18} aria-hidden="true" />
    <input type="search" {...props} />
  </label>
);

export const FilterBar = ({ search, filters, actions, className }) => (
  <div className={joinClassNames("ui-filter-bar", className)}>
    {search && <div className="ui-filter-search">{search}</div>}
    {filters && <div className="ui-filter-controls">{filters}</div>}
    {actions && <div className="ui-filter-actions">{actions}</div>}
  </div>
);

export const StatusBadge = ({ children, tone = "neutral", className }) => (
  <span className={joinClassNames("ui-status-badge", `tone-${tone}`, className)}>
    {children}
  </span>
);

export const InlineAlert = ({ tone = "error", children }) => (
  <div className={`ui-inline-alert tone-${tone}`} role={tone === "error" ? "alert" : "status"}>
    <AlertCircle size={18} aria-hidden="true" />
    <span>{children}</span>
  </div>
);

export const FormField = ({
  label,
  id,
  hint,
  error,
  required,
  children,
  className,
}) => (
  <div className={joinClassNames("ui-form-field", error && "has-error", className)}>
    {label && (
      <label htmlFor={id}>
        <span>{label}</span>
        {required && <span className="ui-required" aria-hidden="true">*</span>}
      </label>
    )}
    {children}
    {hint && !error && <p className="ui-field-hint">{hint}</p>}
    {error && <p className="ui-field-error">{error}</p>}
  </div>
);

export const SegmentedTabs = ({ items, value, onChange, className, ariaLabel }) => (
  <div className={joinClassNames("ui-segmented-tabs", className)} role="tablist" aria-label={ariaLabel}>
    {items.map((item) => {
      const Icon = item.icon;
      const active = item.value === value;

      return (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={active}
          className={active ? "active" : ""}
          onClick={() => onChange(item.value)}
        >
          {Icon && <Icon size={16} aria-hidden="true" />}
          <span>{item.label}</span>
        </button>
      );
    })}
  </div>
);

export const TableShell = ({ children, className, labelledBy }) => (
  <div className={joinClassNames("ui-table-shell", className)} role="region" aria-labelledby={labelledBy}>
    {children}
  </div>
);

export const FileCard = ({ children }) => (
  <SurfaceCard className="ui-file-card" as="article">
    <FileText size={18} aria-hidden="true" />
    <div>{children}</div>
  </SurfaceCard>
);
