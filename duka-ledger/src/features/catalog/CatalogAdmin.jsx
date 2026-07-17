import { useState } from 'react';
import { useQuery } from '@powersync/react';
import { db } from '../../powersync/SetupPowerSync';

export function CatalogAdmin() {
  const { data: categories } = useQuery(`SELECT * FROM categories ORDER BY category_name ASC`);
  const { data: items } = useQuery(`
    SELECT items.*, categories.category_name 
    FROM items 
    LEFT JOIN categories ON items.category_id = categories.id
    ORDER BY items.item_name ASC
  `);

  // State for Categories
  const [newCategory, setNewCategory] = useState('');
  
  // State for Items
  const [itemName, setItemName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [editingItemId, setEditingItemId] = useState(null);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;

    // Local check for duplicates
    const duplicate = categories?.some(
      (c) => c.category_name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      alert('This category already exists!');
      return;
    }

    try {
      await db.execute(
        `INSERT INTO categories (id, category_name, created_at) VALUES (?, ?, ?)`,
        [crypto.randomUUID(), name, new Date().toISOString()]
      );
      setNewCategory('');
      alert('Category added successfully!');
    } catch (err) {
      console.error(err);
      alert('Error creating category.');
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const name = itemName.trim();
    const price = parseFloat(retailPrice);

    if (!name || isNaN(price) || price < 0 || !categoryId) {
      alert('Please fill out all fields with valid values.');
      return;
    }

    // Local check for duplicate item name
    const duplicate = items?.some(
      (item) => item.item_name.toLowerCase() === name.toLowerCase() && item.id !== editingItemId
    );
    if (duplicate) {
      alert('An item with this name already exists!');
      return;
    }

    try {
      if (editingItemId) {
        await db.execute(
          `UPDATE items SET category_id = ?, item_name = ?, retail_price = ?, updated_at = ? WHERE id = ?`,
          [categoryId, name, price.toFixed(2), new Date().toISOString(), editingItemId]
        );
        setEditingItemId(null);
        alert('Item updated successfully!');
      } else {
        await db.execute(
          `INSERT INTO items (id, category_id, item_name, retail_price, updated_at) VALUES (?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), categoryId, name, price.toFixed(2), new Date().toISOString()]
        );
        alert('Item added to price catalog!');
      }
      setItemName('');
      setRetailPrice('');
      setCategoryId('');
    } catch (err) {
      console.error(err);
      alert('Error saving catalog item.');
    }
  };

  const handleEditItem = (item) => {
    setEditingItemId(item.id);
    setItemName(item.item_name);
    setCategoryId(item.category_id || '');
    setRetailPrice(parseFloat(item.retail_price).toString());
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await db.execute(`DELETE FROM items WHERE id = ?`, [id]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 mt-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Catalog Admin Workspace</h2>
        <p className="text-sm text-gray-500">Add categories, products, and update retail price indexes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: CREATION FORMS */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* CATEGORY FORM */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-4">Create Category</h3>
            <form onSubmit={handleAddCategory} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g., Beverages, Detergents"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-sm font-semibold transition"
              >
                Add Category
              </button>
            </form>
          </div>

          {/* ITEM FORM */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-4">
              {editingItemId ? 'Modify Item Info' : 'Register New Item'}
            </h3>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Parent Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Choose Category --</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Item Specific Name & Variation</label>
                <input
                  type="text"
                  placeholder="e.g., Sunlight 10g, Coca Cola 300ml"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Retail Selling Price (KES)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex gap-2">
                {editingItemId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItemId(null);
                      setItemName('');
                      setCategoryId('');
                      setRetailPrice('');
                    }}
                    className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-semibold hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold transition"
                >
                  {editingItemId ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: ACTIVE DATABASE LISTS */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm lg:col-span-2 overflow-hidden">
          <h3 className="text-base font-bold text-gray-800 mb-4">Active Pricing Inventory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[500px]">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                <tr>
                  <th className="py-3 px-3">Item Variant Name</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Retail Price</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items?.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition font-medium">
                    <td className="py-3 px-3 text-gray-900 font-bold">{item.item_name}</td>
                    <td className="py-3 px-3">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded text-xs">
                        {item.category_name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-blue-600 font-bold">
                      {parseFloat(item.retail_price).toFixed(2)} KES
                    </td>
                    <td className="py-3 px-3 text-center space-x-2">
                      <button
                        onClick={() => handleEditItem(item)}
                        className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded text-xs font-semibold transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded text-xs font-semibold transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {(!items || items.length === 0) && (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-gray-400">No items on catalog yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}