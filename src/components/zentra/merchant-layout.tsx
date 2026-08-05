// src/components/zentra/merchant-layout.tsx

// Header with open/close toggle and profile link
<header className="sticky top-0 z-30 border-b border-border bg-card/90 px-4 py-3 backdrop-blur-md">
  <div className="flex items-center justify-between">
    <div className="min-w-0">
      <h1 className="truncate font-display text-lg font-extrabold">
        {store.data?.business_name ?? "My Store"}
      </h1>
      <p className="text-xs text-muted-foreground">Merchant dashboard</p>
    </div>
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggleOpen}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-bold transition-colors",
          isOpen
            ? "bg-success-soft text-success"
            : "bg-secondary text-muted-foreground"
        )}
      >
        {isOpen ? "Open" : "Closed"}
      </button>
      <Link
        to="/account"
        className="grid size-8 place-items-center rounded-full border border-border bg-secondary"
      >
        <span className="size-4 rounded-full bg-accent/30" />
      </Link>
    </div>
  </div>
</header>