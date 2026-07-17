import { useState } from 'react';
import { useQuery } from '@powersync/react';

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
  const filteredItems = (items || []).filter((item) => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All' || item.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 mt-6 pb-12">
      
      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Duka Price Check</h2>
          <p className="text-xs text-gray-500">Instantly look up retail variation prices for checkout</p>
        </div>
      </div>

      {/* STICKY SEARCH & CATEGORY CHIPS CONTAINER */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4">
        {/* Search Field */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-base pointer-events-none">🔍</span>
          <input
            type="text"
            placeholder="Search items instantly... (e.g., Sunlight, Cola)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 text-sm font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* Category Horizontal Scrolling Chips */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Filter by Category</span>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 border ${
                selectedCategory === 'All'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
              }`}
            >
              All Products
            </button>
            {categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 border ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                }`}
              >
                {cat.category_name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LIVE GRID RESULT TILES (Fully Responsive for Mobile/Tablet/Desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-gray-300 transition duration-150"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                {item.category_name || 'Unassigned'}
              </span>
              <h4 className="text-base font-bold text-gray-900 leading-snug">{item.item_name}</h4>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-150 flex items-baseline justify-between">
              <span className="text-xs text-gray-400 font-medium">Price</span>
              <span className="text-lg font-black text-blue-600 tracking-tight">
                {parseFloat(item.retail_price).toFixed(2)} <span className="text-xs font-bold">KES</span>
              </span>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-lg border border-gray-200">
            <span className="text-3xl block mb-2">🔎</span>
            <p className="text-gray-400 text-sm font-semibold">No items match your search filter criteria.</p>
          </div>
        )}
      </div>

    </div>
  );
}