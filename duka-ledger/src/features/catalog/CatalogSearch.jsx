import { useMemo, useState } from 'react';
import { useQuery } from '@powersync/react';
import { Search as SearchIcon, X, Tag, Filter } from 'lucide-react';
import { getSearchMatchScore } from './catalogSearchUtils';

const PRICE_BADGE_DAYS = 5;

const formatPrice = (value) => Number.parseFloat(value || 0).toFixed(2);

const hasPreviousPrice = (item) => {
  if (!item.previous_price) return false;
  return formatPrice(item.previous_price) !== formatPrice(item.retail_price);
};

const isNewPrice = (changedAt) => {
  if (!changedAt) return false;

  const changedTime = new Date(changedAt).getTime();
  if (Number.isNaN(changedTime)) return false;

  const badgeWindowMs = PRICE_BADGE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - changedTime <= badgeWindowMs;
};

export function CatalogSearch() {
  const { data: categories } = useQuery(`SELECT * FROM categories ORDER BY category_name ASC`);
  const { data: items } = useQuery(`
    SELECT items.*, categories.category_name 
    FROM items 
    LEFT JOIN categories ON items.category_id = categories.id
    ORDER BY items.item_name ASC
  `);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Live filter operations on local SQLite data array
  const filteredItems = useMemo(() => {
    return (items || [])
      .map((item) => ({
        item,
        searchScore: getSearchMatchScore(item.item_name, searchTerm)
      }))
      .filter(({ item, searchScore }) => {
        const matchesCategory =
          selectedCategory === 'All' || item.category_id === selectedCategory;
        return searchScore > 0 && matchesCategory;
      })
      .sort((a, b) => {
        if (b.searchScore !== a.searchScore) return b.searchScore - a.searchScore;

        const aHasNewPrice = isNewPrice(a.item.price_changed_at);
        const bHasNewPrice = isNewPrice(b.item.price_changed_at);
        if (aHasNewPrice !== bHasNewPrice) return bHasNewPrice - aHasNewPrice;

        return a.item.item_name.localeCompare(b.item.item_name);
      })
      .map(({ item }) => item);
  }, [items, searchTerm, selectedCategory]);

  // Compute item counts per category ID
  const categoryItemCounts = useMemo(() => {
    const counts = { All: (items || []).length };
    (items || []).forEach((item) => {
      if (item.category_id) {
        counts[item.category_id] = (counts[item.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [items]);

  const selectedCategoryObj = useMemo(
    () => categories?.find((c) => c.id === selectedCategory),
    [categories, selectedCategory]
  );

  return (
    <div className="space-y-6 mt-6 pb-12 animate-fade-in">
      
      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-primary tracking-tight">Price Lookup</h2>
          <p className="text-sm text-slate-500 font-medium">Search items instantly to check variations and retail checkout pricing</p>
        </div>
      </div>

      {/* STICKY SEARCH & CATEGORY CHIPS CONTAINER */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
        
        {/* Search Field */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
            <SearchIcon className="h-5 w-5" />
          </span>
          <input
            type="text"
            placeholder="Type item name here to look up price... (e.g., Sunlight, Milk)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-10 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-primary placeholder:text-slate-400 bg-slate-50/20 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent focus:bg-white transition duration-150"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-650 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Category Horizontal Scrolling Chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              <Filter className="h-3.5 w-3.5 text-secondary" />
              <span>Filter by Category</span>
            </div>
            <div className="text-xs font-semibold text-slate-500">
              {selectedCategory === 'All' ? (
                <span>All Products: <strong className="text-primary font-black">{items?.length || 0} items</strong></span>
              ) : (
                <span>
                  <strong className="text-primary font-black">{selectedCategoryObj?.category_name || 'Category'}</strong>: <strong className="text-secondary font-black">{categoryItemCounts[selectedCategory] || 0} {categoryItemCounts[selectedCategory] === 1 ? 'item' : 'items'}</strong>
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 border cursor-pointer flex items-center gap-2 ${
                selectedCategory === 'All'
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100'
              }`}
            >
              <span>All Products</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                selectedCategory === 'All'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200/80 text-slate-700'
              }`}>
                {items?.length || 0}
              </span>
            </button>
            {categories?.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const count = categoryItemCounts[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 border cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100'
                  }`}
                >
                  <span>{cat.category_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODERN VERTICAL LIST RESULTS CONTAINER */}
      {filteredItems.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/60 shadow-xs">
          <span className="text-3xl block mb-3">🔎</span>
          <p className="text-slate-500 text-sm font-bold">No catalog items match your lookup filter criteria.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs divide-y divide-slate-100/80 overflow-hidden">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/50 active:bg-slate-100/60 transition group cursor-pointer"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm sm:text-base font-extrabold text-primary group-hover:text-secondary-dark transition">
                    {item.item_name}
                  </h4>
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/30 uppercase tracking-wider">
                    {item.category_name || 'Unassigned'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold">Product ID: {item.id.slice(0, 8).toUpperCase()}</p>
              </div>
              
              <div className="text-right space-y-1">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center justify-end gap-1">
                  <Tag className="h-3 w-3 text-secondary" />
                  <span>Price</span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  {isNewPrice(item.price_changed_at) && (
                    <span className="rounded-full border border-secondary/20 bg-secondary/10 px-2 py-0.5 text-[9px] font-black uppercase text-secondary-dark">
                      new
                    </span>
                  )}
                  <span className="text-base sm:text-lg font-black text-secondary tracking-tight">
                    KES {formatPrice(item.retail_price)}
                  </span>
                </div>
                {hasPreviousPrice(item) && (
                  <div className="text-[11px] font-bold text-slate-400 line-through">
                    KES {formatPrice(item.previous_price)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
