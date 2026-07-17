import { useState, useEffect } from 'react';
import { useQuery } from '@powersync/react';
import { db } from '../../powersync/SetupPowerSync';
import { useToast } from '../../context/ToastContext';
import { Plus, Edit, Trash2, FolderPlus, ShoppingBag, DollarSign, Lock, Unlock, Delete } from 'lucide-react';

export function CatalogAdmin() {
  const toast = useToast();

  // Catalog Security States (PIN Protection)
  const [isUnlocked, setIsUnlocked] = useState(() => sessionStorage.getItem('catalogUnlocked') === 'true');
  const [pinCode, setPinCode] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleLock = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('catalogUnlocked');
    setPinCode('');
    setPinError(false);
    toast.info('Workspace Locked', 'Catalog settings have been locked.');
  };

  const handleKeyPress = (num) => {
    setPinError(false);
    if (pinCode.length >= 4) return;
    
    const newPin = pinCode + num;
    setPinCode(newPin);

    // Auto-validate once 4 digits are entered
    if (newPin.length === 4) {
      const correctPin = import.meta.env.VITE_CATALOG_PIN || '2540';
      if (newPin === correctPin) {
        setIsUnlocked(true);
        sessionStorage.setItem('catalogUnlocked', 'true');
        toast.success('Workspace Unlocked', 'Access to catalog management authorized.');
      } else {
        setPinError(true);
        setTimeout(() => {
          setPinCode('');
        }, 300);
        toast.error('Access Denied', 'Incorrect Manager Security PIN.');
      }
    }
  };

  const handleDelete = () => {
    setPinError(false);
    setPinCode(prev => prev.slice(0, -1));
  };

  // Auto-lock when the user navigates away from this page
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('catalogUnlocked');
    };
  }, []);

  useEffect(() => {
    if (isUnlocked) return;

    const handleHardwareKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        setPinCode('');
        setPinError(false);
      }
    };

    window.addEventListener('keydown', handleHardwareKeyDown);
    return () => window.removeEventListener('keydown', handleHardwareKeyDown);
  }, [pinCode, isUnlocked]);

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
      toast.warning('Duplicate Entry', 'This category already exists in the registry.');
      return;
    }

    try {
      await db.execute(
        `INSERT INTO categories (id, category_name, created_at) VALUES (?, ?, ?)`,
        [crypto.randomUUID(), name, new Date().toISOString()]
      );
      setNewCategory('');
      toast.success('Category Added', `"${name}" has been registered successfully.`);
    } catch (err) {
      console.error(err);
      toast.error('Operation Failed', 'Could not record category to local database.');
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const name = itemName.trim();
    const price = parseFloat(retailPrice);

    if (!name || isNaN(price) || price < 0 || !categoryId) {
      toast.error('Validation Error', 'Please fill out all fields with valid pricing details.');
      return;
    }

    // Local check for duplicate item name
    const duplicate = items?.some(
      (item) => item.item_name.toLowerCase() === name.toLowerCase() && item.id !== editingItemId
    );
    if (duplicate) {
      toast.warning('Duplicate Item', 'A product variation with this name is already cataloged.');
      return;
    }

    try {
      if (editingItemId) {
        await db.execute(
          `UPDATE items SET category_id = ?, item_name = ?, retail_price = ?, updated_at = ? WHERE id = ?`,
          [categoryId, name, price.toFixed(2), new Date().toISOString(), editingItemId]
        );
        setEditingItemId(null);
        toast.success('Item Updated', `"${name}" details were updated successfully.`);
      } else {
        await db.execute(
          `INSERT INTO items (id, category_id, item_name, retail_price, updated_at) VALUES (?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), categoryId, name, price.toFixed(2), new Date().toISOString()]
        );
        toast.success('Product Added', `"${name}" has been registered in the pricing index.`);
      }
      setItemName('');
      setRetailPrice('');
      setCategoryId('');
    } catch (err) {
      console.error(err);
      toast.error('Operation Failed', 'Could not sync product data to local database.');
    }
  };

  const handleEditItem = (item) => {
    setEditingItemId(item.id);
    setItemName(item.item_name);
    setCategoryId(item.category_id || '');
    setRetailPrice(parseFloat(item.retail_price).toString());
    
    // Smooth scroll to top of form on mobile viewports
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this catalog item?')) return;
    try {
      await db.execute(`DELETE FROM items WHERE id = ?`, [id]);
      toast.success('Item Deleted', 'The product has been removed from the registry.');
    } catch (err) {
      console.error(err);
      toast.error('Operation Failed', 'Could not delete item.');
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-slate-200/60 rounded-3xl shadow-xl p-8 flex flex-col items-center space-y-8 animate-zoom-in">
          {/* LOCK HEADER */}
          <div className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 bg-accent/5 text-accent rounded-full flex items-center justify-center border border-accent/10 shadow-inner">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-black text-primary tracking-tight mt-3">Catalog Locked</h3>
            <p className="text-xs text-slate-500 font-medium max-w-[240px] mx-auto">
              Please enter the 4-digit manager PIN to authorize modifications.
            </p>
          </div>

          {/* DOTS FIELD */}
          <div className="flex gap-4 items-center justify-center py-2">
            {[0, 1, 2, 3].map((idx) => {
              const hasDigit = pinCode.length > idx;
              return (
                <div 
                  key={idx} 
                  className={`h-4.5 w-4.5 rounded-full border-2 transition-all duration-150 ${
                    hasDigit 
                      ? 'bg-primary border-primary scale-110 shadow-sm shadow-primary/25' 
                      : pinError 
                        ? 'border-accent bg-accent/10 animate-bounce' 
                        : 'border-slate-300 bg-slate-50'
                  }`}
                />
              );
            })}
          </div>

          {/* PIN PAD KEYPAD */}
          <div className="grid grid-cols-3 gap-4 w-full">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleKeyPress(String(num))}
                className="h-14 w-full rounded-2xl border border-slate-200/50 bg-slate-50/50 text-lg font-bold text-primary hover:bg-slate-100/80 active:bg-slate-200/60 transition duration-100 flex items-center justify-center cursor-pointer shadow-xs select-none font-sans"
              >
                {num}
              </button>
            ))}
            
            {/* Backspace */}
            <button
              onClick={handleDelete}
              className="h-14 w-full rounded-2xl border border-slate-250 bg-slate-100 text-slate-500 hover:bg-slate-150 active:bg-slate-200 transition flex items-center justify-center cursor-pointer shadow-xs select-none"
              title="Delete last digit"
            >
              <Delete className="h-5 w-5" />
            </button>
            
            {/* Zero */}
            <button
              onClick={() => handleKeyPress('0')}
              className="h-14 w-full rounded-2xl border border-slate-200/50 bg-slate-50/50 text-lg font-bold text-primary hover:bg-slate-100/80 active:bg-slate-200/60 transition duration-100 flex items-center justify-center cursor-pointer shadow-xs select-none font-sans"
            >
              0
            </button>

            {/* Clear */}
            <button
              onClick={() => { setPinCode(''); setPinError(false); }}
              className="h-14 w-full rounded-2xl border border-slate-200/40 bg-white text-xs font-black text-slate-400 hover:text-slate-650 hover:bg-slate-50 active:bg-slate-100 transition flex items-center justify-center cursor-pointer shadow-xs select-none uppercase tracking-wider font-sans"
            >
              Clear
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Contact manager for access PIN</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 mt-6 pb-12 animate-fade-in">
      {/* HEADER TITLE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-primary tracking-tight">Catalog Admin Workspace</h2>
          <p className="text-sm text-slate-500 font-medium">Add categories, products, and update retail price indexes</p>
        </div>
        <button 
          onClick={handleLock}
          className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 active:bg-slate-100 text-xs font-bold text-slate-600 shadow-xs flex items-center gap-1.5 self-start sm:self-auto transition cursor-pointer"
        >
          <Lock className="h-4 w-4 text-slate-450" />
          <span>Lock Workspace</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: CREATION FORMS */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* CATEGORY FORM */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <FolderPlus className="h-5 w-5 text-secondary" />
              <h3 className="text-sm sm:text-base font-extrabold text-primary tracking-tight">Create Category</h3>
            </div>
            
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g., Beverages, Detergents"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4 text-secondary" />
                <span>Add Category</span>
              </button>
            </form>
          </div>

          {/* ITEM FORM */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-5 w-5 text-secondary" />
              <h3 className="text-sm sm:text-base font-extrabold text-primary tracking-tight">
                {editingItemId ? 'Modify Item Info' : 'Register New Item'}
              </h3>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
             <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Parent Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition bg-white"
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
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Item Variant Name</label>
                <input
                  type="text"
                  placeholder="e.g., Sunlight 10g, Coca Cola 300ml"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Retail Selling Price</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">KES</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                    required
                  />
                </div>
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
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-2 w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {editingItemId ? <Edit className="h-4 w-4 text-secondary" /> : <Plus className="h-4 w-4 text-secondary" />}
                  <span>{editingItemId ? 'Update Item' : 'Add Item'}</span>
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: ACTIVE DATABASE LISTS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs lg:col-span-2 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-secondary" />
            <h3 className="text-sm sm:text-base font-extrabold text-primary tracking-tight">Active Pricing Inventory</h3>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar -mx-6 px-6">
            <table className="w-full text-left text-sm text-slate-600 min-w-[500px]">
              <thead className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase border-b border-slate-200/60">
                <tr>
                  <th className="py-3.5 px-4 rounded-l-xl">Item Variant Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Retail Price</th>
                  <th className="py-3.5 px-4 text-center rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items?.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4 text-primary font-bold">{item.item_name}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg text-xs font-semibold border border-slate-200/30">
                        {item.category_name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-primary font-extrabold tracking-tight">
                      {parseFloat(item.retail_price).toFixed(2)} KES
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => handleEditItem(item)}
                          className="px-2 py-1 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/50 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          <Edit className="h-3.5 w-3.5 text-secondary" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="px-2 py-1 bg-accent/5 text-accent hover:bg-accent/10 border border-accent/10 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-accent" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!items || items.length === 0) && (
                  <tr>
                    <td colSpan="4" className="py-12 text-center text-slate-400 text-xs font-semibold">
                      No items registered on price catalog yet.
                    </td>
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