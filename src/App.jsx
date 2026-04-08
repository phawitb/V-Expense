import React, { useState, useEffect, useRef } from 'react';
import { Home, MessageCircle, Plus, Camera, Wallet, Calendar, Send, Loader2, Target, Receipt, TrendingDown, Image as ImageIcon, X, Users, Copy, LogIn, ChevronDown, ChevronUp, Pencil, Check, Trash2, LogOut } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from '@react-oauth/google';

// --- API Setup ---
const API_BASE = window.location.hostname === 'localhost' 
  ? "http://localhost:5001/api" 
  : "https://v-expense-api.onrender.com/api"; 
const GOOGLE_CLIENT_ID = "561203798169-01m6dcriti21hbbrn5p54ddmg34f65c0.apps.googleusercontent.com";

const fetchGemini = async (payload, isJson = false) => {
  try {
    const response = await fetch(`${API_BASE}/ai/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload })
    });
    const data = await response.json();
    
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) throw new Error("No valid response from AI");
    
    if (isJson) {
      const cleanJsonStr = textResponse.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanJsonStr);
    }
    return textResponse;
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
};

// --- Constants ---
const colorPalette = [
  { color: 'bg-orange-400', iconColor: 'text-orange-600', bgColor: 'bg-orange-50' },
  { color: 'bg-blue-400', iconColor: 'text-blue-600', bgColor: 'bg-blue-50' },
  { color: 'bg-pink-400', iconColor: 'text-pink-600', bgColor: 'bg-pink-50' },
  { color: 'bg-purple-400', iconColor: 'text-purple-600', bgColor: 'bg-purple-50' },
  { color: 'bg-emerald-400', iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { color: 'bg-yellow-400', iconColor: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  { color: 'bg-red-400', iconColor: 'text-red-600', bgColor: 'bg-red-50' },
  { color: 'bg-cyan-400', iconColor: 'text-cyan-600', bgColor: 'bg-cyan-50' },
];

const defaultCategories = [
  { id: 'cat-1', name: 'อาหาร+ของใช้ทั่วไป', budget: 0, ...colorPalette[0] },
  { id: 'cat-2', name: 'สาธารณูปโภค', budget: 0, ...colorPalette[1] },
  { id: 'cat-3', name: 'อื่นๆ', budget: 0, ...colorPalette[2] }
];

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <MainApp />
    </GoogleOAuthProvider>
  );
}

function MainApp() {
  // Auth State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('v_expense_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [savedWallets, setSavedWallets] = useState(() => {
    try {
      const saved = localStorage.getItem('smartspend_wallets');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const initialId = Math.random().toString(36).substring(2, 8).toUpperCase();
    return [{ id: initialId, name: 'กระเป๋าหลัก' }];
  });

  const [walletId, setWalletId] = useState(() => {
    const active = localStorage.getItem('smartspend_active_wallet');
    if (active && savedWallets.some(w => w.id === active)) {
      return active;
    }
    return savedWallets[0]?.id;
  });

  useEffect(() => {
    if (walletId) {
      localStorage.setItem('smartspend_active_wallet', walletId);
    }
  }, [walletId]);
  
  // UI State
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState(null);
  const [isSettingBudget, setIsSettingBudget] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  
  // Data State
  const [categories, setCategories] = useState(defaultCategories);
  const [categorySettings, setCategorySettings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedChatImage, setSelectedChatImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editingTx, setEditingTx] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null); // { groupId, shopName, items: [] }
  const [editingWalletId, setEditingWalletId] = useState(null);
  const [editWalletNameInput, setEditWalletNameInput] = useState('');
  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [addWalletInput, setAddWalletInput] = useState('');
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  
  const [chatMessages, setChatMessages] = useState([{ role: 'model', content: 'สวัสดีครับ! ต้องการเช็คยอดหมวดไหน หรือสอบถามรายจ่ายอะไร ถามได้เลยครับ' }]);
  const [chatInput, setChatInput] = useState('');
  
  const fileInputRef = useRef(null);
  const chatFileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // --- Keyboard & Mobile Responsiveness ---
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (activeTab === 'chat') {
      // เลื่อนลงไปล่างสุดและ Focus ช่องพิมพ์ทันที
      if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => chatInputRef.current?.focus(), 150);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!window.visualViewport) return;
    
    const handleResize = () => {
      // ถ้าความสูงลดลงมากกว่า 15% แสดงว่าคีย์บอร์ดน่าจะเปิดอยู่
      const isVisible = window.visualViewport.height < window.innerHeight * 0.85;
      setIsKeyboardOpen(isVisible);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    return () => window.visualViewport.removeEventListener('resize', handleResize);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast("คัดลอก Wallet ID สำเร็จ!");
  };

  const openBudgetModal = () => {
    setCategorySettings(categories.map(c => ({...c})));
    setIsConfirmingReset(false);
    setIsSettingBudget(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAddCategorySetting = () => {
    const newColor = colorPalette[categorySettings.length % colorPalette.length];
    setCategorySettings(prev => [...prev, { id: `cat-${Date.now()}`, name: '', budget: 0, ...newColor }]);
  };

  const handleUpdateCategorySetting = (id, field, value) => {
    setCategorySettings(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleRemoveCategorySetting = (id) => {
    setCategorySettings(prev => prev.filter(c => c.id !== id));
  };

  const handleCreateWallet = () => {
    if (!addWalletInput.trim()) return showToast("กรุณากรอกชื่อกระเป๋า");
    const name = addWalletInput.trim();
    const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setSavedWallets(prev => [...prev, { id: newId, name: name }]);
    setWalletId(newId);
    setIsAddingWallet(false);
    setAddWalletInput('');
    showToast(`สร้างกระเป๋า "${name}" เรียบร้อย`);
  };

  const handleJoinWallet = () => {
    if (!addWalletInput.trim()) return showToast("กรุณากรอก Wallet ID");
    const newId = addWalletInput.trim().toUpperCase();
    if (!savedWallets.find(w => w.id === newId)) {
      setSavedWallets(prev => [...prev, { id: newId, name: `กระเป๋า ${newId}` }]);
    }
    setWalletId(newId);
    setIsAddingWallet(false);
    setAddWalletInput('');
    showToast(`เข้าร่วม Wallet: ${newId} แล้ว`);
  };

  const handleRemoveWallet = (idToRemove) => {
    if (savedWallets.length === 1) return showToast("ต้องมีกระเป๋าอย่างน้อย 1 ใบ");
    const newWallets = savedWallets.filter(w => w.id !== idToRemove);
    setSavedWallets(newWallets);
    if (walletId === idToRemove) setWalletId(newWallets[0].id);
  };

  const handleSaveWalletName = (id) => {
    if (!editWalletNameInput.trim()) return;
    setSavedWallets(prev => prev.map(w => w.id === id ? { ...w, name: editWalletNameInput.trim() } : w));
    setEditingWalletId(null);
    showToast("เปลี่ยนชื่อกระเป๋าเรียบร้อย");
  };

  // --- Auth Handlers ---
  const handleLoginSuccess = async (response) => {
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      if (!res.ok) throw new Error("Login Failed");
      const userData = await res.json();
      setUser(userData);
      localStorage.setItem('v_expense_user', JSON.stringify(userData));
      showToast(`ยินดีต้อนรับคุณ ${userData.name}`);
    } catch (err) {
      showToast("เข้าสู่ระบบไม่สำเร็จ");
    }
  };

  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      googleLogout();
      setUser(null);
      localStorage.removeItem('v_expense_user');
      showToast("ออกจากระบบเรียบร้อยแล้ว");
    }
  };

  // --- API Sync ---
  const syncData = async () => {
    if (!walletId || !user) return;
    try {
      const res = await fetch(`${API_BASE}/wallet/${walletId}`);
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      
      if (data.config?.categories?.length > 0) setCategories(data.config.categories);
      else setCategories(defaultCategories);
      
      const txs = data.transactions.map(t => ({ ...t, id: t._id }));
      setTransactions(txs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      syncData();
      const interval = setInterval(syncData, 5000);
      return () => clearInterval(interval);
    }
  }, [walletId, user]);

  useEffect(() => {
    localStorage.setItem('smartspend_wallets', JSON.stringify(savedWallets));
  }, [savedWallets]);

  // --- Calculations ---
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysRemaining = lastDay.getDate() - today.getDate() + 1;
  const totalBudget = categories.reduce((sum, cat) => sum + (Number(cat.budget) || 0), 0);
  const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
  const remainingBudget = Math.max(0, totalBudget - totalSpent);
  const dailyBudget = daysRemaining > 0 ? (remainingBudget / daysRemaining).toFixed(0) : 0;

  const categorySpending = categories.map(cat => {
    const spent = transactions.filter(t => t.category === cat.name).reduce((s, t) => s + t.amount, 0);
    const remaining = Math.max(0, cat.budget - spent);
    const daily = daysRemaining > 0 ? (remaining / daysRemaining).toFixed(0) : 0;
    return { ...cat, spent, remaining, daily };
  });

  const unknownSpent = transactions.filter(t => !categories.map(c => c.name).includes(t.category)).reduce((s, t) => s + t.amount, 0);

  const spendingByUser = transactions.reduce((acc, t) => {
    const uid = t.createdBy || 'Unknown';
    acc[uid] = (acc[uid] || 0) + t.amount;
    return acc;
  }, {});
  
  const userColors = ['bg-emerald-400', 'bg-blue-400', 'bg-purple-400', 'bg-orange-400', 'bg-pink-400'];
  const userSpendingData = Object.entries(spendingByUser).map(([uid, amount], idx) => {
    const txOfUser = transactions.find(t => t.createdBy === uid);
    return {
      uid, amount, color: userColors[idx % userColors.length],
      percent: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      label: uid === user?.uid ? 'คุณ' : (txOfUser?.userName || `ผู้ใช้ ${uid.substring(0, 4)}`)
    };
  }).sort((a, b) => b.amount - a.amount);

  // --- Logic Handlers ---
  const handleSaveBudget = async () => {
    try {
      await fetch(`${API_BASE}/wallet/${walletId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: categorySettings.map(c => ({...c, budget: Number(c.budget) || 0})) })
      });
      setIsSettingBudget(false);
      showToast("บันทึกเป้าหมายสำเร็จ");
      syncData();
    } catch (err) {
      showToast("บันทึกไม่สำเร็จ");
    }
  };

  const handleAddExpense = async () => {
    if (!inputText.trim() && !selectedImage) return;
    setIsLoading(true);
    try {
      const parts = [{ text: inputText.trim() || "ดึงข้อมูลจากรูปภาพ" }];
      if (selectedImage) {
        const base64Data = selectedImage.split(',')[1];
        const mimeType = selectedImage.match(/[^:]\w+\/[\w-+\d.]+(?=;|,)/)[0];
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }

      const availableCats = categories.map(c => `"${c.name}"`).join(', ');
      const payload = {
        contents: [{ role: "user", parts }],
        systemInstruction: {
          parts: [{ text: `คุณคือระบบบันทึกรายจ่าย ตอบกลับเป็น JSON เท่านั้น: {"shopName": "...", "items": [{"item": "...", "amount": 0, "category": "หนึ่งใน [${availableCats}]"}]}` }]
        },
        generationConfig: { responseMimeType: "application/json" }
      };

      const result = await fetchGemini(payload, true);
      
      if (result?.items?.length > 0) {
        const batchId = Date.now().toString();
        const txs = result.items.map(item => ({
          item: item.item,
          amount: Number(item.amount),
          category: item.category || categories[0].name,
          date: new Date().toISOString(),
          groupId: batchId,
          shopName: result.shopName || '',
          createdBy: user.uid,
          userName: user.name,
          userPicture: user.picture
        }));

        await fetch(`${API_BASE}/wallet/${walletId}/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(txs)
        });

        setInputText('');
        setSelectedImage(null);
        showToast("บันทึกรายจ่ายเรียบร้อย");
        syncData();
      }
    } catch (e) {
      showToast("AI ขัดข้อง");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTx = async (id) => {
    if (!window.confirm("ลบรายการนี้?")) return;
    try {
      await fetch(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
      showToast("ลบรายการแล้ว");
      syncData();
    } catch (err) { showToast("ลบไม่สำเร็จ"); }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm("คุณต้องการลบบิลนี้ทั้งใบ (ทุกรายการในกลุ่ม) ใช่หรือไม่?")) return;
    try {
      await fetch(`${API_BASE}/transactions/group/${groupId}`, { method: 'DELETE' });
      showToast("ลบทั้งกลุ่มเรียบร้อยแล้ว");
      syncData();
    } catch (err) { showToast("ลบไม่สำเร็จ"); }
  };

  const handleSaveEdit = async () => {
    if (!editingTx) return;
    try {
      await fetch(`${API_BASE}/transactions/${editingTx.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: editingTx.item,
          amount: Number(editingTx.amount),
          category: editingTx.category
        })
      });
      setEditingTx(null);
      showToast("แก้ไขรายการเรียบร้อย");
      syncData();
    } catch (err) {
      showToast("แก้ไขไม่สำเร็จ");
    }
  };

  const handleSaveGroupEdit = async () => {
    if (!editingGroup) return;
    setIsLoading(true);
    try {
      // Update each item in the group
      const updatePromises = editingGroup.items.map(item => 
        fetch(`${API_BASE}/transactions/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item: item.item,
            amount: Number(item.amount),
            category: item.category,
            shopName: editingGroup.shopName
          })
        })
      );
      await Promise.all(updatePromises);
      setEditingGroup(null);
      showToast("แก้ไขบิลเรียบร้อยแล้ว");
      syncData();
    } catch (err) {
      showToast("แก้ไขไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetWallet = async () => {
    setIsLoading(true);
    try {
      await fetch(`${API_BASE}/wallet/${walletId}/reset`, { method: 'DELETE' });
      setIsConfirmingReset(false);
      setIsSettingBudget(false);
      showToast("รีเซ็ตกระเป๋าและลบข้อมูลสำเร็จ");
      syncData();
    } catch (err) {
      showToast("เกิดข้อผิดพลาดในการรีเซ็ต");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() && !selectedChatImage) return;
    
    const userMsg = { 
      role: 'user', 
      content: chatInput,
      image: selectedChatImage 
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    const currentImage = selectedChatImage;
    setSelectedChatImage(null);
    if (chatFileInputRef.current) chatFileInputRef.current.value = '';
    
    setIsLoading(true);
    try {
      const parts = [{ text: chatInput || "วิเคราะห์รูปภาพนี้ให้หน่อย" }];
      if (currentImage) {
        const base64Data = currentImage.split(',')[1];
        const mimeType = currentImage.match(/[^:]\w+\/[\w-+\d.]+(?=;|,)/)[0];
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }

      const txHistory = transactions.map(t => `- ${t.item} (${t.amount} บาท)`).join('\n');
      const payload = {
        contents: [{ parts }],
        systemInstruction: {
          parts: [{ text: `คุณคือผู้ช่วยทางการเงิน ข้อมูลปัจจุบัน:\n${txHistory}\nรวมใช้จ่าย: ${totalSpent} บาท` }]
        }
      };
      const aiText = await fetchGemini(payload, false);
      setChatMessages(prev => [...prev, { role: 'model', content: aiText }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'model', content: 'ขัดข้องชั่วคราว' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // --- Auth Screen ---
  if (!user) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border w-full max-w-sm border-gray-100">
          <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center text-white mb-6 mx-auto shadow-lg shadow-emerald-100">
            <Wallet size={40} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2 tracking-tight">SmartSpend<span className="text-emerald-500">.</span></h1>
          <p className="text-gray-500 mb-8 leading-relaxed font-medium">บันทึกรายจ่ายอัจฉริยะร่วมกับเพื่อน<br/>ด้วยระบบ Cloud & AI</p>
          <div className="flex justify-center">
            <GoogleLogin onSuccess={handleLoginSuccess} onError={() => showToast("เข้าสู่ระบบไม่สำเร็จ")} useOneTap shape="pill" theme="outline" />
          </div>
          <p className="mt-8 text-[10px] text-gray-400 uppercase tracking-widest font-bold">Secure Login with MongoDB Atlas</p>
        </div>
      </div>
    );
  }

  // --- Main UI Rendering ---
  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Budget Summary Card */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-gray-700">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet size={120} /></div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-300 text-sm font-medium">เป้าหมายของเดือนนี้</p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">฿{totalBudget.toLocaleString()}</h2>
            </div>
            <button onClick={openBudgetModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors" title="ตั้งเป้าหมายและหมวดหมู่"><Target size={18} /></button>
          </div>
          <p className="text-emerald-400 text-sm font-medium mb-4 flex items-center gap-1.5"><Calendar size={14}/> เหลืออีก {daysRemaining} วัน <span className="text-gray-400 text-xs ml-1">(ใช้ได้ ฿{dailyBudget}/วัน)</span></p>

          <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-md border border-white/10 space-y-3">
            {categorySpending.map(cat => (
              <div key={cat.id} className="flex justify-between items-start text-sm">
                <div className="flex items-center gap-2 mt-0.5 max-w-[55%]"><div className={`w-2 h-2 rounded-full shrink-0 ${cat.color}`}></div><span className="text-gray-200 truncate">{cat.name}</span></div>
                <div className="text-right shrink-0 pl-2">
                  <span className="font-semibold">฿{cat.spent.toLocaleString()} <span className="text-xs text-gray-400 font-normal">/ {cat.budget.toLocaleString()}</span></span>
                  {cat.budget > 0 && <div className="text-[10px] text-emerald-400">เหลือใช้ ฿{cat.daily}/วัน</div>}
                </div>
              </div>
            ))}
            {unknownSpent > 0 && (
              <div className="flex justify-between items-start text-sm opacity-60">
                <div className="flex items-center gap-2 mt-0.5"><div className="w-2 h-2 rounded-full bg-gray-500 shrink-0"></div><span className="text-gray-300">หมวดหมู่ที่ถูกลบไปแล้ว</span></div>
                <div className="text-right"><span className="font-semibold text-gray-300">฿{unknownSpent.toLocaleString()}</span></div>
              </div>
            )}
            <div className="pt-3 mt-1 border-t border-white/10">
              <div className="flex justify-between items-center mb-3"><span className="font-medium text-gray-300">รวมที่ใช้ไป</span><span className="text-lg font-bold text-white">฿{totalSpent.toLocaleString()}</span></div>
              {userSpendingData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex w-full h-2 rounded-full overflow-hidden bg-white/10">{userSpendingData.map(u => <div key={u.uid} style={{ width: `${u.percent}%` }} className={`${u.color}`} title={`${u.label}: ฿${u.amount}`}></div>)}</div>
                  <div className="flex flex-wrap gap-2.5 text-[10px]">
                    {userSpendingData.map(u => (
                      <div key={u.uid} className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${u.color}`}></div><span className="text-gray-300">{u.label}: <span className="text-white font-medium">฿{u.amount.toLocaleString()}</span></span></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className={`
        transition-all duration-300 z-30
        ${isKeyboardOpen ? 'fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-emerald-100 shadow-2xl animate-in slide-in-from-bottom-full' : 'bg-white rounded-3xl p-5 shadow-sm border border-gray-100'}
      `}>
        <div className="flex items-center justify-between mb-2">
          <h3 className={`text-sm font-semibold text-gray-800 flex items-center gap-2 ${isKeyboardOpen ? 'hidden' : 'block'}`}>
            <Plus size={16} className="text-emerald-500"/> บันทึกรายจ่ายใน Wallet
          </h3>
          {isKeyboardOpen && <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider pl-1">กำลังบันทึกรายจ่าย...</span>}
          {isKeyboardOpen && (
            <button 
              onClick={() => { document.activeElement.blur(); setIsKeyboardOpen(false); }}
              className="text-[10px] bg-gray-100 px-2 py-1 rounded-md text-gray-500 font-bold"
            >
              เสร็จสิ้น
            </button>
          )}
        </div>

        {selectedImage && (
          <div className={`relative mb-3 rounded-xl overflow-hidden border border-gray-200 shadow-sm ${isKeyboardOpen ? 'w-16 h-16 ml-1' : 'w-24 h-24'}`}>
            <img src={selectedImage} alt="Receipt" className="w-full h-full object-cover" />
            <button onClick={() => { setSelectedImage(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full"><X size={10} /></button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors shrink-0">
            <Camera size={22} />
          </button>
          <div className={`flex-1 bg-gray-50 rounded-xl flex items-center px-4 border border-gray-100 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-50 transition-all ${isKeyboardOpen ? 'ring-2 ring-emerald-100 border-emerald-300' : ''}`}>
            <input 
              type="text" 
              placeholder={isKeyboardOpen ? "ซื้ออะไรไปกี่บาท..." : "เช่น ค่าไฟบ้าน 1200 บาท"} 
              className="w-full bg-transparent border-none focus:outline-none py-3 text-sm"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddExpense()}
            />
          </div>
          <button 
            onClick={handleAddExpense}
            disabled={isLoading || (!inputText.trim() && !selectedImage)}
            className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 active:scale-95 disabled:opacity-50 transition-colors shrink-0"
          >
            {isLoading ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} />}
          </button>
        </div>
      </div>


      {/* Transactions List */}
      <div className="pb-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 px-1 flex items-center gap-2"><Receipt size={16} className="text-gray-500"/> รายการล่าสุด</h3>
        <div className="space-y-3">
          {transactions.length === 0 ? <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-3xl border border-dashed border-gray-200"><Receipt size={32} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Wallet นี้ยังไม่มีการใช้จ่าย</p></div> : (
            (() => {
              const groupedTransactions = [];
              transactions.forEach(tx => {
                if (!tx.groupId) groupedTransactions.push({ id: tx.id, isGroup: false, items: [tx] });
                else {
                  const lastGroup = groupedTransactions[groupedTransactions.length - 1];
                  if (lastGroup && lastGroup.groupId === tx.groupId) lastGroup.items.push(tx);
                  else groupedTransactions.push({ id: tx.groupId, groupId: tx.groupId, isGroup: true, items: [tx] });
                }
              });
              
              const displayGroups = groupedTransactions.map(g => g.items.length === 1 ? { ...g, isGroup: false } : g);

              return displayGroups.map((group) => {
                if (!group.isGroup) {
                  const tx = group.items[0];
                  const catConfig = categories.find(c => c.name === tx.category) || { bgColor: 'bg-gray-50', iconColor: 'text-gray-600' };
                  return (
                    <div key={tx.id} className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm border border-gray-100 hover:border-emerald-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${catConfig.bgColor} ${catConfig.iconColor}`}><TrendingDown size={20} /></div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate pr-2">{tx.item}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium truncate max-w-[100px]">{tx.category}</span>
                            <span className="text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 flex items-center gap-1 shrink-0"><Users size={10} /> {tx.createdBy === user?.uid ? 'คุณ' : `ผู้ใช้ ${tx.createdBy?.substring(0, 4) || '??'}`}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">{new Date(tx.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 pl-2">
                        <p className="font-semibold text-gray-800">-฿{tx.amount.toLocaleString()}</p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditingTx(tx)} className="text-gray-300 hover:text-emerald-500 p-1 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => handleDeleteTx(tx.id)} className="text-gray-300 hover:text-red-500 p-1 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  const groupTotal = group.items.reduce((s, t) => s + t.amount, 0);
                  const firstTx = group.items[0];
                  const shopNameDisplay = firstTx.shopName || "บิลรวมรายการ";
                  const isExpanded = expandedGroups.has(group.id);
                  return (
                    <div key={group.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-emerald-100 transition-colors overflow-hidden">
                      <div className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleGroup(group.id)}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl shrink-0"><Receipt size={18} /></div>
                          <div className="min-w-0 pr-2"><span className="font-semibold text-gray-800 text-sm truncate block">{shopNameDisplay} <span className="text-gray-500 text-xs font-normal">({group.items.length} รายการ)</span></span>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                              <span className="text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 flex items-center gap-1 shrink-0"><Users size={10} /> {firstTx.createdBy === user?.uid ? 'คุณ' : `ผู้ใช้ ${firstTx.createdBy?.substring(0, 4) || '??'}`}</span>
                              <span className="text-[10px] shrink-0">{new Date(firstTx.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <p className="font-bold text-gray-800">-฿{groupTotal.toLocaleString()}</p>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingGroup({ groupId: firstTx.groupId, shopName: firstTx.shopName || '', items: group.items }); }}
                              className="text-gray-300 hover:text-emerald-500 p-1 transition-colors"
                              title="แก้ไขทั้งบิล"
                            >
                              <Pencil size={16} />
                            </button>
                            <div className="text-gray-400 bg-gray-50 p-1 rounded-full">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50/50 border-t border-gray-50 space-y-3">
                          {group.items.map(tx => {
                            const catConfig = categories.find(c => c.name === tx.category) || { bgColor: 'bg-gray-50', iconColor: 'text-gray-600' };
                            return (
                              <div key={tx.id} className="flex items-center justify-between pl-2 border-l-2 border-gray-100 ml-3">
                                <div className="flex items-center gap-3 pl-3 min-w-0">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${catConfig.bgColor} ${catConfig.iconColor}`}><TrendingDown size={14} /></div>
                                  <div className="min-w-0 pr-2"><p className="text-sm font-medium text-gray-800 truncate">{tx.item}</p><span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-md font-medium mt-0.5 inline-block truncate max-w-[100px]">{tx.category}</span></div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0"><p className="font-medium text-sm text-gray-800">-฿{tx.amount.toLocaleString()}</p>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => setEditingTx(tx)} className="text-gray-300 hover:text-emerald-500 p-1 transition-colors"><Pencil size={12} /></button>
                                    <button onClick={() => handleDeleteTx(tx.id)} className="text-gray-300 hover:text-red-500 p-1 transition-colors"><Trash2 size={12} /></button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
              });
            })()
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex justify-center font-sans text-gray-900 pb-24">
      <div className="w-full max-w-md bg-[#f8fafc] p-4 flex flex-col relative">
        <header className="py-4 px-2 flex justify-between items-center mb-2 gap-2">
          <div><h1 className="text-xl font-bold text-gray-800 tracking-tight">SmartSpend<span className="text-emerald-500">.</span></h1><p className="text-xs text-gray-500 font-medium font-mono mt-0.5">ID: {walletId}</p></div>
          <button onClick={() => setIsWalletModalOpen(true)} className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-full shadow-sm text-xs font-semibold text-emerald-600 border border-emerald-100 hover:bg-emerald-50 transition-colors max-w-[160px]"><Wallet size={14} className="shrink-0" /> <span className="font-bold tracking-wide truncate">{savedWallets.find(w => w.id === walletId)?.name || 'กระเป๋าหลัก'}</span> <ChevronDown size={12} className="shrink-0" /></button>
        </header>

        <main className="flex-1">{activeTab === 'home' ? renderDashboard() : (
          <div className="flex flex-col h-[calc(100vh-140px)] animate-in fade-in duration-300">
            <div className={`bg-emerald-500 text-white p-4 rounded-3xl mb-4 shadow-md flex items-center gap-3 ${isKeyboardOpen ? 'hidden' : 'flex'}`}>
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle size={20} />
              </div>
              <div>
                <h2 className="font-semibold">ผู้ช่วย AI ทางการเงิน</h2>
                <p className="text-xs text-emerald-100">วิเคราะห์ข้อมูลใน Shared Wallet</p>
              </div>
            </div>

            <div className={`flex-1 overflow-y-auto space-y-4 px-1 pb-4 ${isKeyboardOpen ? 'pb-20' : ''}`}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-emerald-500 text-white rounded-br-sm' 
                      : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm leading-relaxed whitespace-pre-wrap'
                  }`}>
                    {msg.image && (
                      <img src={msg.image} alt="Upload" className="w-full max-h-48 object-cover rounded-lg mb-2 border border-white/20" />
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-bl-sm shadow-sm">
                    <Loader2 size={20} className="animate-spin text-emerald-500" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Sticky Chat Input */}
            <div className={`
              transition-all duration-300 z-30 mt-auto
              ${isKeyboardOpen ? 'fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-emerald-100 shadow-2xl' : 'bg-white rounded-2xl p-2 border border-gray-200 shadow-sm'}
            `}>
              {selectedChatImage && (
                <div className="relative w-20 h-20 mb-2 ml-2 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                  <img src={selectedChatImage} alt="Chat preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setSelectedChatImage(null)}
                    className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={chatFileInputRef} 
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setSelectedChatImage(reader.result);
                      reader.readAsDataURL(file);
                    }
                  }} 
                />
                <button 
                  onClick={() => chatFileInputRef.current?.click()}
                  className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                >
                  <Camera size={20} />
                </button>
                <div className={`flex-1 bg-gray-50 rounded-xl flex items-center px-4 border border-gray-100 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-50 transition-all ${isKeyboardOpen ? 'ring-2 ring-emerald-100 border-emerald-300' : ''}`}>
                  <input 
                    ref={chatInputRef}
                    type="text" 
                    placeholder="พิมพ์คำถามหรือส่งรูปบิล..." 
                    className="w-full bg-transparent border-none focus:outline-none py-2 text-sm"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                </div>
                <button 
                  onClick={handleSendMessage} 
                  disabled={isLoading || (!chatInput.trim() && !selectedChatImage)} 
                  className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 active:scale-95 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </div>
            </div>
          </div>
        )}</main>

        {isSettingBudget && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-2"><h3 className="text-lg font-bold">ตั้งเป้าหมายและหมวดหมู่</h3><button onClick={() => setIsSettingBudget(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
              <p className="text-xs text-gray-500 mb-4">ปรับแต่งหมวดหมู่ค่าใช้จ่าย และตั้งงบประมาณที่คุณต้องการในเดือนนี้ได้เลย</p>
              <div className="space-y-3 mb-4 max-h-[40vh] overflow-y-auto pr-2">
                {categorySettings.map((cat) => (
                  <div key={cat.id} className="flex items-start gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100 relative group">
                    <div className={`mt-3 w-3 h-3 rounded-full shrink-0 ${cat.color} shadow-sm`}></div>
                    <div className="flex-1 space-y-2">
                      <input type="text" className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="ชื่อหมวดหมู่" value={cat.name} onChange={(e) => handleUpdateCategorySetting(cat.id, 'name', e.target.value)} />
                      <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">฿</span><input type="number" className="w-full bg-white border border-gray-200 rounded-lg py-2 pl-7 pr-3 text-sm font-semibold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="งบประมาณ" value={cat.budget || ''} onChange={(e) => handleUpdateCategorySetting(cat.id, 'budget', e.target.value)} /></div>
                    </div>
                    <button onClick={() => handleRemoveCategorySetting(cat.id)} className="text-gray-300 hover:text-red-500 p-1.5 bg-white rounded-lg border border-gray-100 shadow-sm transition-colors" title="ลบหมวดหมู่"><X size={14} /></button>
                  </div>
                ))}
              </div>
              <button onClick={handleAddCategorySetting} className="w-full py-2.5 mb-5 rounded-xl border-2 border-dashed border-emerald-200 text-emerald-600 bg-emerald-50 text-sm font-semibold hover:border-emerald-400 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"><Plus size={16} /> เพิ่มหมวดหมู่</button>
              {!isConfirmingReset ? (
                <div className="flex flex-col gap-3">
                  <button onClick={handleSaveBudget} className="w-full py-3.5 rounded-2xl font-semibold text-white bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-200 transition-all active:scale-95">บันทึกการตั้งค่า</button>
                  <button onClick={() => setIsConfirmingReset(true)} className="w-full py-2.5 rounded-2xl font-semibold text-red-500 bg-white border border-red-200 hover:bg-red-50 transition-colors">รีเซ็ตกระเป๋า (เคลียร์ข้อมูล)</button>
                </div>
              ) : (
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 animate-in fade-in zoom-in-95 duration-200"><p className="text-sm font-semibold text-red-700 mb-1 text-center">ยืนยันการลบข้อมูลทั้งหมด?</p>
                  <div className="flex gap-2"><button onClick={() => setIsConfirmingReset(false)} className="flex-1 py-2 rounded-xl text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 text-xs font-semibold transition-colors">ยกเลิก</button><button onClick={handleResetWallet} disabled={isLoading} className="flex-1 py-2 rounded-xl text-white bg-red-500 hover:bg-red-600 text-xs font-semibold flex justify-center items-center transition-colors">{isLoading ? <Loader2 size={14} className="animate-spin" /> : "ยืนยันการรีเซ็ต"}</button></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Group Edit Modal */}
        {editingGroup && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="text-lg font-bold">แก้ไขบิลรวม</h3>
                <button onClick={() => setEditingGroup(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
              </div>
              
              <div className="mb-4 shrink-0">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">ชื่อร้านค้า / หัวข้อบิล</label>
                <input 
                  type="text" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  value={editingGroup.shopName}
                  onChange={(e) => setEditingGroup({...editingGroup, shopName: e.target.value})}
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-6">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">รายการในบิล</p>
                {editingGroup.items.map((item, idx) => (
                  <div key={item.id} className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        className="flex-1 bg-white border border-gray-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="ชื่อรายการ"
                        value={item.item}
                        onChange={(e) => {
                          const newItems = [...editingGroup.items];
                          newItems[idx].item = e.target.value;
                          setEditingGroup({...editingGroup, items: newItems});
                        }}
                      />
                      <div className="relative w-24">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">฿</span>
                        <input 
                          type="number" 
                          className="w-full bg-white border border-gray-200 rounded-lg py-1.5 pl-5 pr-2 text-xs font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          value={item.amount}
                          onChange={(e) => {
                            const newItems = [...editingGroup.items];
                            newItems[idx].amount = e.target.value;
                            setEditingGroup({...editingGroup, items: newItems});
                          }}
                        />
                      </div>
                    </div>
                    <select 
                      className="w-full bg-white border border-gray-200 rounded-lg py-1.5 px-3 text-[10px] focus:outline-none"
                      value={item.category}
                      onChange={(e) => {
                        const newItems = [...editingGroup.items];
                        newItems[idx].category = e.target.value;
                        setEditingGroup({...editingGroup, items: newItems});
                      }}
                    >
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="shrink-0 space-y-3 pt-2 border-t">
                <div className="flex justify-between items-center px-1">
                  <span className="text-sm font-bold text-gray-600">ยอดรวมแก้ไข</span>
                  <span className="text-lg font-bold text-emerald-600">฿{editingGroup.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0).toLocaleString()}</span>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (window.confirm("คุณต้องการลบบิลนี้ทั้งใบใช่หรือไม่?")) {
                        handleDeleteGroup(editingGroup.groupId);
                        setEditingGroup(null);
                      }
                    }}
                    className="p-3.5 rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                    title="ลบบิลนี้"
                  >
                    <Trash2 size={20} />
                  </button>
                  <button 
                    onClick={handleSaveGroupEdit}
                    disabled={isLoading}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : "บันทึกการแก้ไข"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingTx && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold mb-4">แก้ไขรายการ</h3>
              <div className="space-y-4 mb-6">
                <div><label className="text-xs font-semibold text-gray-600 mb-1 block">ชื่อรายการ</label><input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={editingTx.item} onChange={(e) => setEditingTx(prev => ({...prev, item: e.target.value}))} /></div>
                <div><label className="text-xs font-semibold text-gray-600 mb-1 block">จำนวนเงิน (บาท)</label><input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={editingTx.amount} onChange={(e) => setEditingTx(prev => ({...prev, amount: e.target.value}))} /></div>
                <div><label className="text-xs font-semibold text-gray-600 mb-1 block">หมวดหมู่</label><select className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={editingTx.category} onChange={(e) => setEditingTx(prev => ({...prev, category: e.target.value}))}>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
              </div>
              <div className="flex gap-3"><button onClick={() => setEditingTx(null)} className="flex-1 py-3.5 rounded-2xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">ยกเลิก</button><button onClick={handleSaveEdit} className="flex-1 py-3.5 rounded-2xl font-semibold text-white bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-200 transition-all active:scale-95">บันทึก</button></div>
            </div>
          </div>
        )}

        {isWalletModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">จัดการกระเป๋าเงิน</h3><button onClick={() => { setIsWalletModalOpen(false); setIsAddingWallet(false); }} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                {savedWallets.map(w => (
                  <div key={w.id} className={`p-3 rounded-xl border flex justify-between items-center ${w.id === walletId ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex-1 min-w-0">
                      {editingWalletId === w.id ? (
                        <div className="flex items-center gap-2 mb-1 pr-2"><input autoFocus className="flex-1 bg-white border border-emerald-300 rounded px-2 py-1 text-sm focus:outline-none min-w-0" value={editWalletNameInput} onChange={(e) => setEditWalletNameInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveWalletName(w.id)} /><button onClick={() => handleSaveWalletName(w.id)} className="text-emerald-600 p-1 bg-emerald-100 rounded hover:bg-emerald-200 shrink-0"><Check size={14}/></button><button onClick={() => setEditingWalletId(null)} className="text-gray-500 p-1 bg-gray-200 rounded hover:bg-gray-300 shrink-0"><X size={14}/></button></div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0 pr-2"><span className="font-bold text-sm text-gray-800 truncate">{w.name}</span><button onClick={() => { setEditingWalletId(w.id); setEditWalletNameInput(w.name); }} className="text-gray-400 hover:text-emerald-600 transition-colors shrink-0"><Pencil size={12} /></button>{w.id === walletId && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold shrink-0">ใช้งานอยู่</span>}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1"><span className="text-xs text-gray-500 font-mono truncate">ID: {w.id}</span><button onClick={() => copyToClipboard(w.id)} className="text-gray-400 hover:text-emerald-600 shrink-0"><Copy size={12} /></button></div>
                    </div>
                    <div className="flex items-center gap-2 pl-2 shrink-0">{w.id !== walletId && <button onClick={() => setWalletId(w.id)} className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-50 font-medium">สลับ</button>}<button onClick={() => handleRemoveWallet(w.id)} className="text-gray-300 hover:text-red-500 p-1"><X size={14} /></button></div>
                  </div>
                ))}
              </div>
              {isAddingWallet ? (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-xs font-semibold text-emerald-800 mb-2">เพิ่มกระเป๋า / เข้าร่วมด้วย ID</p>
                  <input autoFocus placeholder="กรอกชื่อกระเป๋าใหม่ หรือ Wallet ID..." className="w-full bg-white border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3" value={addWalletInput} onChange={(e) => setAddWalletInput(e.target.value)} />
                  <div className="flex gap-2 mb-2"><button onClick={handleCreateWallet} className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors">สร้างใหม่</button><button onClick={handleJoinWallet} className="flex-1 py-2 text-xs font-semibold text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors">Join (ID)</button></div>
                  <button onClick={() => setIsAddingWallet(false)} className="w-full py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">ยกเลิก</button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button onClick={() => setIsAddingWallet(true)} className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-semibold hover:border-emerald-500 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"><Plus size={16} /> เพิ่มกระเป๋า</button>
                  <button onClick={handleLogout} className="w-full mt-2 py-3 bg-red-50 text-red-500 rounded-2xl text-xs font-bold flex items-center justify-center gap-2"><LogOut size={14}/> ออกจากระบบ</button>
                </div>
              )}
            </div>
          </div>
        )}

        {toast && <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300"><div className="bg-gray-900 text-white px-5 py-3 rounded-full shadow-xl text-sm font-medium flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400"></div>{toast}</div></div>}
{/* Bottom Navigation */}
<nav className={`
  fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 pb-safe z-40 transition-transform duration-300
  ${isKeyboardOpen ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}
`}>
  <div className="max-w-md mx-auto flex justify-around p-3 px-6 relative">

            <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'home' ? 'text-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}><Home size={24} className={activeTab === 'home' ? 'fill-emerald-50 stroke-emerald-500' : ''} /><span className="text-[10px] mt-1 font-medium">หน้าหลัก</span></button>
            <div className="relative -top-6"><button onClick={() => { setActiveTab('home'); setTimeout(() => document.querySelector('input[type="text"]').focus(), 100); }} className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center text-white shadow-xl shadow-gray-300 hover:scale-105 transition-transform active:scale-95"><Plus size={28} /></button></div>
            <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'chat' ? 'text-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}><MessageCircle size={24} className={activeTab === 'chat' ? 'fill-emerald-50 stroke-emerald-500' : ''} /><span className="text-[10px] mt-1 font-medium">ถาม AI</span></button>
          </div>
        </nav>
      </div>
    </div>
  );
}
