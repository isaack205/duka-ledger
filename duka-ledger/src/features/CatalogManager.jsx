import { useState } from 'react';
import { useQuery } from '@powersync/react';
import { db } from '../powersync/SetupPowerSync';

export function CatalogManager() {

  // Queries to fetch categories and joined items for display
  const { data: categories } = useQuery('SELECT * FROM categories ORDER BY category_name ASC');
  const { data: items } = useQuery(`
    SELECT items.*, categories.category_name 
    FROM items 
    LEFT JOIN categories ON items.category_id = categories.id
    ORDER BY items.item_name ASC
  `);

  // Local component state for form inputs
  const [newCategory, setNewCategory] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // insert a new category into the local PowerSync DB
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    try {
      await db.execute(
        'INSERT INTO categories (id, category_name, created_at) VALUES (?, ?, ?)',
        [crypto.randomUUID(), newCategory.trim(), new Date().toISOString()]
      );
      setNewCategory('');
    } catch (err) {
      console.error('Failed to add category:', err);
    }
  };

  // insert a new item linked to a category
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !newPrice || !selectedCategoryId) return;

    try {
      await db.execute(
        'INSERT INTO items (id, category_id, item_name, retail_price, updated_at) VALUES (?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          selectedCategoryId,
          newItemName.trim(),
          parseFloat(newPrice).toFixed(2),
          new Date().toISOString()
        ]
      );
      setNewItemName('');
      setNewPrice('');
    } catch (err) {
      console.error('Failed to add item:', err);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
      
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm md:col-span-1">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Categories</h3>
        {/* Category add form */}
        <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="New Category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition">
            Add
          </button>
        </form>

        {/* Categories list */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {categories?.map((cat) => (
            <div key={cat.id} className="px-3 py-2 bg-gray-50 text-gray-700 rounded-md text-sm border border-gray-100">
              {cat.category_name}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm md:col-span-2">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Items Inventory</h3>
        {/* Item add form */}
        <form onSubmit={handleAddItem} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          <input
            type="text"
            placeholder="Item name"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Price (KES)"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          {/* Category selector for new item */}
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
          >
            <option value="">Category</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.category_name}
              </option>
            ))}
          </select>
          <button type="submit" className="sm:col-span-4 w-full py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition">
            Add Item to Inventory
          </button>
        </form>

        {/* Items table showing joined category name */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 font-medium">
                <th className="py-3 px-2">Item Name</th>
                <th className="py-3 px-2">Category</th>
                <th className="py-3 px-2 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items?.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition">
                  <td className="py-3 px-2 font-medium text-gray-800">{item.item_name}</td>
                  <td className="py-3 px-2">
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                      {item.category_name || 'Uncategorized'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-gray-900">{item.retail_price} KES</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}