
import React, { useState, useMemo, useEffect } from 'react';
import { NordicButton, Modal } from '../components/Shared';
import { CURRENCIES as INITIAL_CURRENCIES, CATEGORY_COLORS } from '../constants';
import type{ Expense, Member } from '../types';
import { dbService } from '../firebaseService';

interface Repayment {
  fromId: string;
  toId: string;
  amount: number;
}

interface Settlement {
  id: string;
  type: 'GLOBAL' | 'EXPENSE';
  currency: string;        // ⭐ 新增
  expenseIds?: string[];
  repayments: Repayment[];
  createdAt: string;
}

interface ExpenseViewProps {
  members: Member[];
} 

const CATEGORIES = [
  { id: 'Food', label: '餐飲', icon: 'fa-utensils' },
  { id: 'Transport', label: '交通', icon: 'fa-car-side' },
  { id: 'Shopping', label: '購物', icon: 'fa-bag-shopping' },
  { id: 'Accommodation', label: '住宿', icon: 'fa-bed' },
  { id: 'Ticket', label: '票券', icon: 'fa-ticket' },
  { id: 'Activity', label: '活動', icon: 'fa-star' },
  { id: 'Others', label: '其他', icon: 'fa-tags' }
];

const CATEGORY_HEX: Record<string, string> = {
  Food: '#D2C2B2',
  Transport: '#8E9CA3',
  Shopping: '#DC8670',
  Accommodation: '#2B2C2B',
  Activity: '#577C8E',
  Attraction: '#577C8E',
  Ticket: '#577C8E',
  Others: '#8E9CA3'
};

const DonutChart: React.FC<{
  data: { label: string; value: number; color: string }[];
  currency: string;
}> = ({ data, currency }) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  let currentPercentage = 0;

  return (
    <div className="relative w-56 h-56 mx-auto flex items-center justify-center">
      <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90 drop-shadow-sm">
        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#F3EBE3" strokeWidth="3.2" />
        {total === 0 ? (
          <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#F3EBE3" strokeWidth="3.2" />
        ) : (
          data.map((item, idx) => {
            const percentage = (item.value / total) * 100;
            const strokeDasharray = `${percentage} ${100 - percentage}`;
            const strokeDashoffset = -currentPercentage;
            currentPercentage += percentage;
            return (
              <circle
                key={idx}
                cx="18"
                cy="18"
                r="15.915"
                fill="transparent"
                stroke={item.color}
                strokeWidth="3.8"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap={percentage > 2 ? "round" : "butt"}
                className="transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
              />
            );
          })
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[10px] font-bold text-earth-dark/50 uppercase tracking-[0.2em] mb-0.5">Total Expenses</span>
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] font-bold text-harbor/60">
  {currency}
</span>
          <span className="text-xl font-bold text-ink tracking-tighter">
            {total.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

const ExpenseView: React.FC<ExpenseViewProps> = ({ members }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>(INITIAL_CURRENCIES);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [activeCurrency, setActiveCurrency] =
  useState<'TWD' | 'EUR'>('TWD');
  useEffect(() => {
    const unsubExp = dbService.subscribeField('expenses', (data) => setExpenses(data || []));
    const unsubSettle = dbService.subscribeField('settlements',(data) => setSettlements(data || []));
    const unsubRates = dbService.subscribeField('currencyRates', (data) => {
      if (data && typeof data === 'object') setCurrencyRates(data as Record<string, number>);
    });
    return () => { unsubExp(); unsubSettle(); unsubRates(); };
  }, []);

  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showRateManager, setShowRateManager] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const [analysisMemberId, setAnalysisMemberId] = useState<string | 'TEAM'>('TEAM');
  const [drillDownCategory, setDrillDownCategory] = useState<string | null>(null);

  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcSourceCurrency, setCalcSourceCurrency] = useState('EUR');
  const [calcTargetCurrency, setCalcTargetCurrency] = useState('TWD');
  const [calcPendingOp, setCalcPendingOp] = useState<string | null>(null);
  const [calcStoredValue, setCalcStoredValue] = useState<number | null>(null);

  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencyRate, setNewCurrencyRate] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const [formData, setFormData] = useState({ 
    amount: '', currency: 'TWD', note: '', category: 'Food', 
    payerId: '', splitWith: [] as string[],
    date: new Date().toISOString().split('T')[0]
  });
  const totalTeamExpense = useMemo(() => {
    return Math.round(expenses.reduce((acc, exp) => {
      if (members.length > 0 && exp.splitWith.length === members.length) {
        if (exp.currency !== activeCurrency) return acc;
        return acc + exp.amount;
      }
      return acc;
    }, 0));
  }, [expenses, members, activeCurrency]);

  const analysisData = useMemo(() => {
const categoriesSum: Record<string, { total: number; items: Expense[] }> = {};
CATEGORIES.forEach(c => {
  categoriesSum[c.id] = { total: 0, items: [] };
});

expenses.forEach(exp => {
  const rate = currencyRates[exp.currency] || 1;

  // ① 這筆是否應該算進來
  const isIncluded =
    analysisMemberId === 'TEAM'
      ? exp.splitWith.length === members.length
      : exp.splitWith.includes(analysisMemberId);

  if (!isIncluded) return;

  // ② 原始分攤金額（還沒換幣）
  const rawAmount =
    analysisMemberId === 'TEAM'
      ? exp.amount
      : exp.amount / exp.splitWith.length;

  // ③ 只在 analysis 做匯率轉換
  const twdValue = rawAmount * rate;

  if (categoriesSum[exp.category]) {
    categoriesSum[exp.category].total += twdValue;
    categoriesSum[exp.category].items.push(exp);
  }
});

    const total = Object.values(categoriesSum).reduce((a, b) => a + b.total, 0);
    const chartData = CATEGORIES.map(c => ({
      id: c.id,
      label: c.label,
      value: Math.round(categoriesSum[c.id].total),
      percentage: total > 0 ? Math.round((categoriesSum[c.id].total / total) * 100) : 0,
      color: CATEGORY_HEX[c.id] || '#577C8E',
      items: categoriesSum[c.id].items
    })).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

    return { total, chartData };
  }, [analysisMemberId, expenses, currencyRates, members, activeCurrency]);

  const currentBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    members.forEach(m => balances[m.id] = 0);

    expenses.forEach(exp => {
      if (exp.currency !== activeCurrency) return;
    
      const amount = exp.amount;
    
      if (balances[exp.payerId] !== undefined) {
        balances[exp.payerId] += amount;
      }
    
      const share = amount / exp.splitWith.length;
      exp.splitWith.forEach(id => {
        if (balances[id] !== undefined) {
          balances[id] -= share;
        }
      });
    });
    settlements
  .filter(s => s.currency === activeCurrency)
  .forEach(settlement => {
    settlement.repayments.forEach(r => {
      balances[r.fromId] += r.amount;
      balances[r.toId] -= r.amount;
    });
  });

    return balances;
  }, [expenses, settlements, members, currencyRates]);

  const settlementData = useMemo(() => {
    const debtors = (Object.entries(currentBalances) as [string, number][]).filter(([_, b]) => b < -0.1).sort((a, b) => a[1] - b[1]);
    const creditors = (Object.entries(currentBalances) as [string, number][]).filter(([_, b]) => b > 0.1).sort((a, b) => b[1] - a[1]);

    const suggested: Repayment[] = [];
    let dIdx = 0, cIdx = 0;
    const dL = debtors.map(d => [...d] as [string, number]);
    const cL = creditors.map(c => [...c] as [string, number]);

    while (dIdx < dL.length && cIdx < cL.length) {
      const transfer = Math.min(Math.abs(dL[dIdx][1]), cL[cIdx][1]);
      suggested.push({ fromId: dL[dIdx][0], toId: cL[cIdx][0], amount: transfer });
      dL[dIdx][1] += transfer;
      cL[cIdx][1] -= transfer;
      if (Math.abs(dL[dIdx][1]) < 0.1) dIdx++;
      if (Math.abs(cL[cIdx][1]) < 0.1) cIdx++;
    }
    return suggested;
  }, [currentBalances]);

  const handleCalcInput = (val: string) => {
    if (val === '.') {
      if (calcDisplay.includes('.')) return;
      setCalcDisplay(calcDisplay + '.');
    } else if (calcDisplay === '0') {
      setCalcDisplay(val);
    } else {
      setCalcDisplay(calcDisplay + val);
    }
  };

  const handleCalcOp = (op: string) => {
    setCalcStoredValue(parseFloat(calcDisplay));
    setCalcPendingOp(op);
    setCalcDisplay('0');
  };

  const handleCalcResult = () => {
    if (calcPendingOp && calcStoredValue !== null) {
      const current = parseFloat(calcDisplay);
      let result = 0;
      switch (calcPendingOp) {
        case '+': result = calcStoredValue + current; break;
        case '-': result = calcStoredValue - current; break;
        case '×': result = calcStoredValue * current; break;
        case '÷': result = current !== 0 ? calcStoredValue / current : 0; break;
      }
      setCalcDisplay(result.toFixed(result % 1 === 0 ? 0 : 2).toString());
      setCalcPendingOp(null);
      setCalcStoredValue(null);
    }
  };

  const handleCalcBack = () => {
    if (calcDisplay.length > 1) {
      setCalcDisplay(calcDisplay.slice(0, -1));
    } else {
      setCalcDisplay('0');
    }
  };

  const handleCalcSwap = () => {
    const temp = calcSourceCurrency;
    setCalcSourceCurrency(calcTargetCurrency);
    setCalcTargetCurrency(temp);
  };

  const calcConvertedValue = useMemo(() => {
    const amount = parseFloat(calcDisplay) || 0;
    const fromRate = currencyRates[calcSourceCurrency] || 1;
    const toRate = currencyRates[calcTargetCurrency] || 1;
    const inTwd = amount * fromRate;
    return (inTwd / toRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [calcDisplay, calcSourceCurrency, calcTargetCurrency, currencyRates]);

  const handleAddCurrency = () => {
    if (!newCurrencyCode || !newCurrencyRate) return;
    const next = { ...currencyRates, [newCurrencyCode.toUpperCase()]: parseFloat(newCurrencyRate) };
    dbService.updateField('currencyRates', next);
    setNewCurrencyCode('');
    setNewCurrencyRate('');
  };

  const deleteCurrency = (code: string) => {
    if (code === 'TWD') return;
    const next = { ...currencyRates };
    delete next[code];
    dbService.updateField('currencyRates', next);
  };

  const syncRates = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/TWD');
      const data = await response.json();
      if (data && data.rates) {
        const next: Record<string, number> = { TWD: 1 };
        Object.entries(currencyRates).forEach(([code]) => {
          if (code === 'TWD') return;
          if (data.rates[code]) {
            next[code] = parseFloat((1 / data.rates[code]).toFixed(4));
          } else {
            next[code] = currencyRates[code];
          }
        });
        dbService.updateField('currencyRates', next);
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      console.error("同步匯率失敗:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (showCalculator) syncRates();
  }, [showCalculator]);

  const handleSaveExpense = (isEditMode: boolean = false) => {
    if (!formData.amount || !formData.payerId || formData.splitWith.length === 0) return;
    
    const exp: Expense = {
      id: isEditMode && selectedExpense ? selectedExpense.id : Date.now().toString(),
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      category: formData.category,
      payerId: formData.payerId,
      splitWith: formData.splitWith,
      addedBy: isEditMode && selectedExpense ? selectedExpense.addedBy : formData.payerId,
      date: formData.date,
      note: formData.note
    };

    let updatedExpenses;
    if (isEditMode && selectedExpense) {
      updatedExpenses = expenses.map(e => e.id === selectedExpense.id ? exp : e);
    } else {
      updatedExpenses = [exp, ...expenses];
    }

    dbService.updateField('expenses', updatedExpenses);
    setShowAdd(false);
    setShowEdit(false);
    setShowDetail(false);
    setSelectedExpense(null);
  };

  const markAsCleared = (repayment: Repayment) => {
const settlement: Settlement = {
  id: Date.now().toString(),
  type: 'GLOBAL',
  currency: activeCurrency,   // ⭐⭐⭐
  repayments: [repayment],
  createdAt: new Date().toISOString(),
};

  dbService.updateField('settlements', [
    settlement,
    ...settlements,
  ]);
};

  const undoSettlement = (settlementId: string) => {
  dbService.updateField('settlements',
    settlements.filter(s => s.id !== settlementId));
};
  const toggleMemberSettled = (exp: Expense, memberId: string) => {
  const existing = settlements.find(
  s =>
    s.type === 'EXPENSE' &&
    s.expenseIds?.includes(exp.id) &&
    s.repayments.some(r => r.fromId === memberId)
);

  if (existing) {
    undoSettlement(existing.id);
    return;
  }

  if (currentBalances[memberId] >= -0.1) return;

  const share = exp.amount / exp.splitWith.length;
  const settlement: Settlement = {
  id: Date.now().toString(),
  type: 'EXPENSE',
  currency: exp.currency,     // ⭐⭐⭐
  expenseIds: [exp.id],
  repayments: [{
    fromId: memberId,
    toId: exp.payerId,
    amount: share,}],
  createdAt: new Date().toISOString(),
};

  dbService.updateField('settlements', [
    settlement,
    ...settlements,
  ]);
};

  const isMemberSettledForExpense = (expId: string, memberId: string) => {
  return settlements.some(
    s =>
      s.currency === activeCurrency &&   // ⭐⭐⭐ 關鍵
      s.type === 'EXPENSE' &&
      s.expenseIds?.includes(expId) &&
      s.repayments.some(r => r.fromId === memberId)
  );
};

  const getCategoryIcon = (cat: string) => CATEGORIES.find(c => c.id === cat)?.icon || 'fa-tags';
  const formatDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const openAddModal = () => {
    setSelectedExpense(null);
    setFormData({
      amount: '', currency: 'TWD', note: '', category: 'Food',
      payerId: members[0]?.id || '', splitWith: members.map(m => m.id),
      date: new Date().toISOString().split('T')[0]
    });
    setShowAdd(true);
  };

  const openEditModal = () => {
    if (!selectedExpense) return;
    setFormData({
      amount: selectedExpense.amount.toString(),
      currency: selectedExpense.currency,
      note: selectedExpense.note,
      category: selectedExpense.category,
      payerId: selectedExpense.payerId,
      splitWith: selectedExpense.splitWith,
      date: selectedExpense.date
    });
    setShowDetail(false);
    setShowEdit(true);
  };

  return (
    <div className="pb-24 px-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-x-hidden">
      <div className="pt-2">
        <h1 className="text-3xl font-bold text-sage tracking-tight">記帳本</h1>
        <p className="text-earth-dark mt-1 font-bold text-xs italic">同步於雲端的團隊開支</p>
      </div>
      <div className="flex gap-2 mt-3">
        {(['TWD', 'EUR'] as const).map(c => (
          <button
            key={c}
            onClick={() => setActiveCurrency(c)}
            className={`
              px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest
              transition-all active:scale-95
              ${
                activeCurrency === c
                  ? 'bg-harbor text-white shadow-md'
                  : 'bg-paper/30 text-earth-dark/50'
              }
            `}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="bg-[#E7DDD3] px-7 py-5 border-none relative overflow-hidden nordic-shadow rounded-[2.5rem] shadow-xl">
        <div className="relative z-10 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-0">
              <span className="text-[10px] text-[#577C8E] font-bold uppercase tracking-[0.2em]">團隊總支出 ( 全體分攤項目 )</span>
              <div className="text-[32px] font-bold text-[#5C4D3C] tracking-tighter leading-tight mt-1">
                {activeCurrency} {totalTeamExpense.toLocaleString()}
              </div>
            </div>
            <div className="w-10 h-10 bg-[#F3EBE3] rounded-2xl flex items-center justify-center text-[#5C4D3C] shadow-sm">
              <i className="fa-solid fa-coins text-base"></i>
            </div>
          </div>
          <div className="bg-[#5C4D3C] px-5 py-2.5 rounded-[1.5rem] flex items-center justify-between text-white/95 shadow-md">
            <span className="text-[11px] font-bold tracking-[0.15em]">結算狀態</span>
            <span className="text-xs font-bold tracking-tight">共 {expenses.length} 筆紀錄</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <button onClick={() => setShowSettlement(true)} className="bg-[#F3EBE3] py-2.5 rounded-[1.5rem] flex flex-col items-center hover:bg-white transition-all shadow-sm active:scale-95">
              <i className="fa-solid fa-hand-holding-dollar text-[#5C4D3C] mb-1 text-sm"></i>
              <span className="text-[9px] text-[#5C4D3C] font-bold tracking-wider">結算</span>
            </button>
            <button onClick={() => setShowCalculator(true)} className="bg-[#F3EBE3] py-2.5 rounded-[1.5rem] flex flex-col items-center hover:bg-white transition-all shadow-sm active:scale-95">
              <i className="fa-solid fa-calculator text-[#5C4D3C] mb-1 text-sm"></i>
              <span className="text-[9px] text-[#5C4D3C] font-bold tracking-wider">換算</span>
            </button>
            <button onClick={() => setShowAnalysis(true)} className="bg-[#F3EBE3] py-2.5 rounded-[1.5rem] flex flex-col items-center hover:bg-white transition-all shadow-sm active:scale-95">
              <i className="fa-solid fa-chart-pie text-[#5C4D3C] mb-1 text-sm"></i>
              <span className="text-[9px] text-[#5C4D3C] font-bold tracking-wider">分析</span>
            </button>
          </div>
        </div>
      </div>

      <NordicButton onClick={openAddModal} className="w-full h-14 bg-sage border-none shadow-xl active:scale-95 transition-all text-sm font-bold tracking-[0.2em] uppercase">
        <i className="fa-solid fa-plus text-xs"></i> 新增支出
      </NordicButton>

      <div className="space-y-3 pb-8">
        {expenses.length === 0 ? (
          <div className="py-16 text-center text-earth-dark/40 italic text-sm font-bold border-2 border-dashed border-paper/30 rounded-[2.5rem]">尚未有花費紀錄</div>
        ) : (
          expenses
          .filter(exp => exp.currency === activeCurrency)
          .map(exp => {
            const isFullSplit = members.length > 0 && exp.splitWith.length === members.length;
            return (
              <div key={exp.id} onClick={() => { setSelectedExpense(exp); setShowDetail(true); }} className="bg-white p-5 rounded-[2rem] border border-paper/40 flex justify-between items-center shadow-md active:scale-98 transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm ${CATEGORY_COLORS[exp.category] || 'bg-sage'}`}>
                    <i className={`fa-solid ${getCategoryIcon(exp.category)} text-lg`}></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-sage text-base tracking-tight">{exp.note || '旅途支出'}</h4>
                    <p className="text-[9px] font-bold text-earth-dark uppercase mt-1 tracking-widest">
                      {members.find(m => m.id === exp.payerId)?.name || '未知'} 已支付
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sage text-base">{exp.currency} {(exp.amount || 0).toLocaleString()}</div>
                  <div className={`text-[8px] font-bold mt-1 px-2 py-0.5 rounded-full inline-block ${isFullSplit ? 'bg-harbor/10 text-harbor' : 'bg-paper/20 text-earth-dark/60'}`}>
                    {isFullSplit ? '全體分攤' : `分攤 ${exp.splitWith.length} 人`}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal isOpen={showAnalysis} onClose={() => { setShowAnalysis(false); setDrillDownCategory(null); }} title="支出比例分析">
        <div className="space-y-6 pb-4">
          <div className="flex justify-between items-center px-1">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-earth-dark/40 uppercase tracking-widest">當前視角</span>
              <span className="text-sm font-bold text-harbor">
                {analysisMemberId === 'TEAM' ? '全團體總支出' : `${members.find(m => m.id === analysisMemberId)?.name} 的個人支出`}
              </span>
            </div>
            <div className="relative group">
              <button className="w-10 h-10 rounded-full bg-white shadow-md border border-paper/30 flex items-center justify-center text-harbor active:scale-90 transition-all">
                <i className="fa-solid fa-user-gear text-sm"></i>
              </button>
              <div className="absolute right-0 top-12 bg-white rounded-2xl shadow-2xl border border-paper/20 p-2 z-50 min-w-[120px] opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all scale-95 group-hover:scale-100">
                <button onClick={() => { setAnalysisMemberId('TEAM'); setDrillDownCategory(null); }} className={`w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest mb-1 ${analysisMemberId === 'TEAM' ? 'bg-harbor text-white' : 'hover:bg-paper/10 text-sage'}`}>
                  <i className="fa-solid fa-users mr-2"></i> 團體
                </button>
                {members.map(m => (
                  <button key={m.id} onClick={() => { setAnalysisMemberId(m.id); setDrillDownCategory(null); }} className={`w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${analysisMemberId === m.id ? 'bg-harbor text-white' : 'hover:bg-paper/10 text-sage'}`}>
                    <img src={m.avatar} className="w-4 h-4 rounded-full" alt="" /> {m.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center py-4 bg-white/40 rounded-[3rem] border border-paper/20 shadow-inner">
            <DonutChart
              currency="NT$"
              data={analysisData.chartData.map(d => ({
                label: d.label,
                value: d.value,
                color: d.color
              }))}
            />
            <span className="mt-2 text-[9px] text-earth-dark/40 italic">
                * 分析金額已統一換算為台幣顯示
              </span>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
            {analysisData.chartData.length === 0 ? (
              <div className="py-12 text-center text-earth-dark/30 italic text-[11px] font-bold">目前暫無相關支出數據</div>
            ) : (
              analysisData.chartData.map(cat => (
                <div key={cat.id} className="space-y-2">
                  <div onClick={() => setDrillDownCategory(drillDownCategory === cat.id ? null : cat.id)} className={`bg-white p-4 rounded-2xl border border-paper/30 flex items-center justify-between shadow-sm cursor-pointer active:scale-98 transition-all ${drillDownCategory === cat.id ? 'ring-2 ring-harbor/20' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs" style={{ backgroundColor: cat.color }}>
                        <i className={`fa-solid ${CATEGORIES.find(c => c.id === cat.id)?.icon || 'fa-tag'}`}></i>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-sage">{cat.label}</span>
                        <span className="text-[9px] font-bold text-earth-dark/60">{cat.percentage}% 佔比</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-sage">
                        NT$ {cat.value.toLocaleString()}
                      </div>
                      <div className="text-[8px] font-bold text-earth-dark/40 uppercase tracking-widest">{cat.items.length} 筆明細</div>
                    </div>
                  </div>
                  {drillDownCategory === cat.id && (
                    <div className="px-2 space-y-1.5 animate-in slide-in-from-top-1 duration-300 pb-2">
                      {cat.items.map(item => (
                        <div key={item.id} className="bg-paper/5 p-3 rounded-xl border border-paper/20 flex justify-between items-center text-[10px] font-bold">
                          <div className="flex flex-col">
                            <span className="text-sage">{item.note || '旅途支出'}</span>
                            <span className="text-earth-dark/50 text-[8px] uppercase tracking-widest">{item.date}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sage">
                              {(() => {
                                  const rate = currencyRates[item.currency] || 1;
                                
                                  const rawShare =
                                    analysisMemberId === 'TEAM'
                                      ? item.amount
                                      : item.amount / item.splitWith.length;
                                
                                  const twdValue = Math.round(rawShare * rate);
                                  const isConverted = item.currency !== 'TWD';
                                
                                  return (
                                    <>
                                      <div className="flex items-center justify-end gap-1.5">
                                        {isConverted && (
                                          <span className="
                                            px-1.5 py-0.5
                                            rounded-full
                                            text-[8px]
                                            font-bold
                                            bg-paper/40
                                            text-earth-dark/60
                                            tracking-tight
                                          ">
                                            ≈
                                          </span>
                                        )}
                                        <span className="text-sage">
                                          NT$ {twdValue.toLocaleString()}
                                        </span>
                                      </div> 
                                    </>
                                  );
                                })()}
                            </div>
                            <div className="text-[7px] text-earth-dark/40">{item.currency} {item.amount.toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <NordicButton onClick={() => setShowAnalysis(false)} className="w-full h-12 bg-harbor text-white border-none shadow-lg text-[10px] tracking-widest uppercase">關閉分析圖表</NordicButton>
        </div>
      </Modal>

      <Modal isOpen={showCalculator} onClose={() => setShowCalculator(false)} title="匯率換算計算機">
        <div className="space-y-5 pb-2">
          <div className="text-center"><span className="text-[9px] font-bold text-earth-dark/40 uppercase tracking-widest">匯率最後更新: {lastSyncTime || '正在同步...'}</span></div>
          <div className="bg-[#E7DDD3] p-5 rounded-4xl border border-paper/40 relative shadow-md">
             <div className="flex items-center justify-between gap-3">
               <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <select value={calcSourceCurrency} onChange={(e) => setCalcSourceCurrency(e.target.value)} className="bg-white px-3 py-1.5 rounded-xl text-[11px] font-bold text-harbor outline-none shadow-sm border border-paper/30">
                      {Object.keys(currencyRates).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span className="text-[8px] font-bold text-earth-dark/60">輸入</span>
                  </div>
                  <div className="text-2xl font-bold text-harbor truncate pr-2">{calcDisplay}</div>
               </div>
               <button onClick={handleCalcSwap} className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-harbor z-10 border border-paper/20"><i className="fa-solid fa-arrows-rotate text-xs"></i></button>
               <div className="flex-1 flex flex-col text-right">
                  <div className="flex items-center justify-end gap-2 mb-2">
                    <span className="text-[8px] font-bold text-earth-dark/60">換算</span>
                    <select value={calcTargetCurrency} onChange={(e) => setCalcTargetCurrency(e.target.value)} className="bg-[#D2C2B2]/30 px-3 py-1.5 rounded-xl text-[11px] font-bold text-harbor outline-none shadow-sm border border-paper/30">
                      {Object.keys(currencyRates).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end justify-end gap-1.5">
                    <span className="text-xs font-bold text-stamp/50 pb-0.5">≈</span>
                    <div className="text-2xl font-bold text-stamp truncate">{calcConvertedValue}</div>
                  </div>
               </div>
             </div>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            <button onClick={() => setCalcDisplay('0')} className="h-14 rounded-2xl bg-stamp/60 text-white font-bold text-base shadow-sm">AC</button>
            <button onClick={handleCalcBack} className="h-14 rounded-2xl bg-stamp/60 text-white font-bold text-base shadow-sm"><i className="fa-solid fa-delete-left"></i></button>
            <button onClick={() => handleCalcOp('÷')} className="h-14 rounded-2xl bg-steel/20 text-harbor font-bold text-xl shadow-sm">÷</button>
            <button onClick={() => handleCalcOp('×')} className="h-14 rounded-2xl bg-steel/20 text-harbor font-bold text-xl shadow-sm">×</button>
            {['7','8','9','-'].map(k => (
              <button key={k} onClick={() => isNaN(parseInt(k)) ? handleCalcOp(k) : handleCalcInput(k)} className={`h-14 rounded-2xl font-bold text-xl shadow-sm ${isNaN(parseInt(k)) ? 'bg-steel/20 text-harbor' : 'bg-white text-harbor border border-paper/20'}`}>{k}</button>
            ))}
            {['4','5','6','+'].map(k => (
              <button key={k} onClick={() => isNaN(parseInt(k)) ? handleCalcOp(k) : handleCalcInput(k)} className={`h-14 rounded-2xl font-bold text-xl shadow-sm ${isNaN(parseInt(k)) ? 'bg-steel/20 text-harbor' : 'bg-white text-harbor border border-paper/20'}`}>{k}</button>
            ))}
            <button onClick={() => handleCalcInput('1')} className="h-14 rounded-2xl bg-white text-harbor font-bold text-xl border border-paper/20 shadow-sm">1</button>
            <button onClick={() => handleCalcInput('2')} className="h-14 rounded-2xl bg-white text-harbor font-bold text-xl border border-paper/20 shadow-sm">2</button>
            <button onClick={() => handleCalcInput('3')} className="h-14 rounded-2xl bg-white text-harbor font-bold text-xl border border-paper/20 shadow-sm">3</button>
            <button onClick={handleCalcResult} className="h-14 rounded-2xl bg-harbor/80 text-white font-bold text-xl shadow-lg">=</button>
            <button onClick={() => handleCalcInput('0')} className="h-14 rounded-2xl bg-white text-harbor font-bold text-xl border border-paper/20 shadow-sm">0</button>
            <button onClick={() => handleCalcInput('.')} className="h-14 rounded-2xl bg-white text-harbor font-bold text-xl border border-paper/20 shadow-sm">.</button>
            <button onClick={() => setShowRateManager(true)} className="h-14 rounded-2xl bg-paper/20 text-harbor font-bold text-lg border border-paper/40 shadow-sm"><i className="fa-solid fa-gear text-sm opacity-60"></i></button>
            <button onClick={() => setShowCalculator(false)} className="h-14 rounded-2xl bg-harbor text-white font-bold text-xl shadow-lg"><i className="fa-solid fa-check"></i></button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showRateManager} onClose={() => setShowRateManager(false)} title="匯率管理設定">
        <div className="space-y-6 pb-4">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold text-earth-dark/60 uppercase tracking-widest">目前匯率清單</span>
            <button onClick={syncRates} disabled={isSyncing} className={`text-[10px] font-bold text-harbor flex items-center gap-1.5 ${isSyncing ? 'opacity-50' : ''}`}>
              <i className={`fa-solid fa-arrows-rotate ${isSyncing ? 'animate-spin' : ''}`}></i>
              {isSyncing ? '正在同步...' : '同步最新'}
            </button>
          </div>
          <div className="space-y-2 max-h-[260px] overflow-y-auto no-scrollbar pr-1">
            {(Object.entries(currencyRates) as [string, number][]).map(([code, rate]) => (
              <div key={code} className="bg-white p-3.5 rounded-2xl border border-paper/30 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-paper/10 flex items-center justify-center font-bold text-harbor text-[11px]">{code}</div>
                  <div className="text-xs font-bold text-harbor tracking-tight">x {rate.toFixed(4)} TWD</div>
                </div>
                {code !== 'TWD' && <button onClick={() => deleteCurrency(code)} className="text-stamp/40 hover:text-stamp p-2"><i className="fa-solid fa-trash-can text-[11px]"></i></button>}
              </div>
            ))}
          </div>
          <div className="bg-[#EBE3D9]/40 p-4 rounded-3xl border-2 border-dashed border-paper/40 space-y-3 shadow-inner">
            <div className="text-center"><span className="text-[9px] font-bold text-earth-dark/50 uppercase tracking-widest">新增自定義匯率</span></div>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="代碼 (JPY)" value={newCurrencyCode} onChange={(e) => setNewCurrencyCode(e.target.value.toUpperCase())} className="w-full p-3 bg-white border border-paper/30 rounded-xl font-bold text-harbor text-[11px] outline-none shadow-sm" />
              <input type="number" placeholder="對台幣匯率" value={newCurrencyRate} onChange={(e) => setNewCurrencyRate(e.target.value)} className="w-full p-3 bg-white border border-paper/30 rounded-xl font-bold text-harbor text-[11px] outline-none shadow-sm" />
            </div>
            <button onClick={handleAddCurrency} className="w-full h-11 bg-stamp text-white rounded-xl text-[10px] tracking-widest uppercase font-bold shadow-md">確認新增匯率</button>
          </div>
          <button onClick={() => setShowRateManager(false)} className="w-full py-3.5 rounded-2xl bg-paper/40 text-harbor text-[10px] tracking-[0.2em] uppercase font-bold">返回計算機</button>
        </div>
      </Modal>

     <Modal isOpen={showSettlement} onClose={() => setShowSettlement(false)} title="團隊還款計畫">
  {/* 🔽 整個 Modal 只有這裡能滑 */}
  <div className="space-y-5 pb-4 max-h-[78vh] overflow-y-auto no-scrollbar">

    {/* ===== 待處理還款 ===== */}
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] font-bold text-earth-dark/40 uppercase tracking-widest">
          待處理還款
        </span>
        <span className="text-[10px] font-bold text-earth-dark/30">
          點擊標記還清
        </span>
      </div>

      {settlementData.length === 0 ? (
        <div className="py-10 border-2 border-dashed border-[#DED4C7] rounded-[2rem] flex items-center justify-center bg-white/10">
          <span className="text-[10px] font-bold text-[#CEC4B7] italic tracking-tight">
            目前沒有新的欠帳
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {settlementData.map((rep, idx) => {
            const from = members.find(m => m.id === rep.fromId);
            const to = members.find(m => m.id === rep.toId);
            return (
              <div
                key={idx}
                onClick={() => markAsCleared(rep)}
                className="bg-white py-3.5 px-5 rounded-[2rem] border border-[#DED4C7] flex items-center justify-between active:scale-95 transition-all cursor-pointer shadow-sm"
              >
                <div className="flex flex-col items-center gap-1 w-12">
                  <img src={from?.avatar} className="w-9 h-9 rounded-full border border-[#E7DDD3]" alt="" />
                  <span className="text-[9px] font-bold text-earth-dark truncate w-full text-center">
                    {from?.name}
                  </span>
                </div>
                <div className="flex-1 px-4 text-center">
                  <div className="text-[15px] font-bold text-harbor mb-0.5">
                    {activeCurrency} {Math.round(rep.amount).toLocaleString()}
                  </div>
                  <div className="flex items-center justify-center opacity-30">
                    <div className="h-[1.5px] bg-paper flex-1"></div>
                    <i className="fa-solid fa-chevron-right text-[7px] mx-1"></i>
                    <div className="h-[1.5px] bg-paper flex-1"></div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 w-12">
                  <img src={to?.avatar} className="w-9 h-9 rounded-full border border-[#E7DDD3]" alt="" />
                  <span className="text-[9px] font-bold text-earth-dark truncate w-full text-center">
                    {to?.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

    {/* ===== 已完成紀錄 ===== */}
    <div className="pt-4">
      <div className="flex justify-between items-center px-1 mb-2">
        <span className="text-[10px] font-bold text-earth-dark/40 uppercase tracking-widest">
          已完成紀錄（點擊可撤銷）
        </span>
      </div>

      {settlements.length === 0 ? (
        <div className="py-6 text-center text-[10px] font-bold text-earth-dark/20 italic">
          尚無歷史紀錄
        </div>
      ) : (
        <div className="space-y-2">
          {settlements
            .filter(s => s.currency === activeCurrency)
            .flatMap(s =>
            s.repayments.map((r, idx) => {
              const from = members.find(m => m.id === r.fromId);
              const to = members.find(m => m.id === r.toId);
              return (
                <div
                  key={`${s.id}-${idx}`}
                  onClick={() => undoSettlement(s.id)}
                  className="bg-[#F5F1EB]/50 py-2.5 px-4 rounded-[1.75rem] border border-[#E5DFD6] flex items-center justify-between active:scale-95 transition-all cursor-pointer opacity-90"
                >
                  <div className="flex flex-col items-center gap-1 w-10">
                    <img src={from?.avatar} className="w-7 h-7 rounded-full border border-white/50 grayscale opacity-40" alt="" />
                    <span className="text-[8px] font-bold text-earth-dark/40">
                      {from?.name}
                    </span>
                  </div>

                  <div className="flex-1 text-center flex flex-col items-center justify-center">
                    <div className="text-[11px] font-bold text-earth-dark/30 line-through mb-0.5">
                      NT$ {Math.round(r.amount).toLocaleString()}
                    </div>
                    <div className="bg-[#E5DFD6]/60 px-3 py-0.5 rounded-full text-[8px] font-bold text-earth-dark/50 uppercase tracking-widest">
                      已結清
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1 w-10">
                    <img src={to?.avatar} className="w-7 h-7 rounded-full border border-white/50 grayscale opacity-40" alt="" />
                    <span className="text-[8px] font-bold text-earth-dark/40">
                      {to?.name}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>

    {/* ===== 底部按鈕 ===== */}
    <NordicButton
      onClick={() => setShowSettlement(false)}
      className="w-full h-14 bg-harbor text-white border-none shadow-xl rounded-2xl text-xs font-bold tracking-[0.2em] uppercase"
    >
      返回記帳本
    </NordicButton>

  </div>
</Modal>

      <Modal isOpen={showAdd || showEdit} onClose={() => { setShowAdd(false); setShowEdit(false); }} title={showEdit ? "修改支出內容" : "記帳一筆支出"}>
        <div className="space-y-5 pb-6 overflow-x-hidden">
          <hr className="border-paper/30 -mx-6 mb-2" />
          <div className="flex gap-2 bg-white border border-paper/40 rounded-2xl p-1.5 shadow-sm">
             <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} className="bg-cream/40 px-4 rounded-xl font-bold text-sage text-xs outline-none">
                {Object.keys(currencyRates).map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <input type="number" placeholder="輸入支出金額" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="flex-grow p-3 bg-transparent font-bold text-sage text-xl outline-none" />
          </div>
          <div className="flex gap-3 min-w-0">
            <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-[100px] h-14 bg-white border border-paper/40 rounded-2xl px-4 font-bold text-sage text-sm outline-none shadow-sm appearance-none">
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <input type="text" placeholder="備註用途" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} className="flex-1 min-w-0 h-14 bg-white border border-paper/40 rounded-2xl px-5 font-bold text-sage text-sm outline-none shadow-sm" />
          </div>
          <div className="relative">
            <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="absolute inset-0 opacity-0 z-10" />
            <div className="w-full h-14 bg-white border border-paper/40 rounded-2xl flex items-center justify-center font-bold text-sage text-base">{formatDateDisplay(formData.date)}</div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-earth-dark/60 uppercase tracking-widest px-1">誰付錢？</label>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {members.map(m => (
                <div key={m.id} onClick={() => setFormData({...formData, payerId: m.id})} className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all cursor-pointer min-w-[120px] ${formData.payerId === m.id ? 'bg-white border-harbor shadow-md' : 'bg-white/50 border-paper/30 opacity-60'}`}>
                  <img src={m.avatar} className="w-8 h-8 rounded-full object-cover border border-paper/20" alt="" />
                  <span className="text-xs font-bold text-sage">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-bold text-earth-dark/60 uppercase tracking-widest">分攤成員</label>
              <button onClick={() => setFormData({...formData, splitWith: members.map(m => m.id)})} className="text-[10px] font-bold text-harbor underline">快速全選</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {members.map(m => (
                <div key={m.id} onClick={() => setFormData(prev => ({ ...prev, splitWith: prev.splitWith.includes(m.id) ? prev.splitWith.filter(id => id !== m.id) : [...prev.splitWith, m.id] }))} className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all cursor-pointer ${formData.splitWith.includes(m.id) ? 'bg-white border-harbor shadow-sm' : 'bg-white/50 border-paper/30 opacity-60'}`}>
                  <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center ${formData.splitWith.includes(m.id) ? 'bg-harbor border-harbor' : 'border-paper'}`}>
                     {formData.splitWith.includes(m.id) && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                  </div>
                  <img src={m.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
                  <span className="text-xs font-bold text-sage">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
          <NordicButton onClick={() => handleSaveExpense(showEdit)} disabled={!formData.amount || !formData.payerId || formData.splitWith.length === 0} className="w-full h-16 bg-harbor text-white border-none shadow-2xl rounded-3xl mt-2 tracking-widest font-bold">
            {showEdit ? "儲存修改內容" : "確認並新增支出"}
          </NordicButton>
        </div>
      </Modal>

      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title="支出分攤明細">
        {selectedExpense && (
          <div className="space-y-6 pb-4 max-h-[75vh] flex flex-col overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-paper/40 shadow-md flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${CATEGORY_COLORS[selectedExpense.category] || 'bg-sage'}`}>
                  <i className={`fa-solid ${CATEGORIES.find(c => c.id === selectedExpense.category)?.icon || 'fa-tags'} text-2xl`}></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-sage leading-tight">{selectedExpense.note || '旅途支出'}</h3>
                  <p className="text-[10px] font-bold text-earth-dark/60 uppercase tracking-widest mt-1">{formatDateDisplay(selectedExpense.date)}</p>
                </div>
              </div>
              <div className="text-right"><div className="text-2xl font-bold text-sage">{selectedExpense.currency} {selectedExpense.amount.toLocaleString()}</div></div>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-paper/40 shadow-sm space-y-4 flex-shrink-0">
              <div className="flex justify-between items-center border-b border-paper/10 pb-3">
                <span className="text-[10px] font-bold text-earth-dark/60 uppercase tracking-widest">代墊付款人</span>
                <div className="flex items-center gap-2"><span className="text-sm font-bold text-sage">{members.find(m => m.id === selectedExpense.payerId)?.name || '未知'}</span><img src={members.find(m => m.id === selectedExpense.payerId)?.avatar} className="w-8 h-8 rounded-full shadow-sm" alt="" /></div>
              </div>
              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center px-1"><span className="text-[10px] font-bold text-earth-dark/60 uppercase tracking-widest">分攤細節</span><span className="text-[10px] font-bold text-earth-dark/60">狀態</span></div>
                <div className="space-y-2">
                  {selectedExpense.splitWith.map(id => {
                    const m = members.find(mem => mem.id === id);
                    const isPayer = id === selectedExpense.payerId;
                    const isSettled = isMemberSettledForExpense(selectedExpense.id, id);
                    const isCurrentlyZeroDebt = !isSettled && currentBalances[id] >= -0.1;
                    const mutedStatusClass ="bg-white/40 px-3 py-1.5 rounded-full text-[9px] font-bold text-earth-dark/40 border border-paper/10";
                    const shareTwd =selectedExpense.amount / selectedExpense.splitWith.length;
                    return (
                      <div key={id} className={`flex justify-between items-center p-4 rounded-[1.75rem] border-2 transition-all ${isPayer ? 'bg-paper/5 border-paper/20' : (isSettled || isCoveredByGlobalSettlement || isCurrentlyZeroDebt) ? 'bg-white/40 border-paper/10 opacity-60' : 'bg-white border-paper/10 shadow-sm'}`}>
                        <div className="flex items-center gap-3">
                          <img src={m?.avatar} className="w-9 h-9 rounded-full border border-paper/20" alt="" />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-sage">{m?.name}</span>
                            <span className="text-[9px] font-bold text-earth-dark/60">
                              應付 {selectedExpense.currency} {shareTwd.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div>
                            {isPayer ? (
                                <i className="fa-solid fa-crown text-yellow-500/40 text-xs mr-2"></i>
                              ) : isSettled ? (
                                <button
                                  onClick={() => toggleMemberSettled(selectedExpense, id)}
                                  className="bg-paper/20 px-3 py-1.5 rounded-full text-[9px] font-bold text-earth-dark"
                                >
                                  已結清
                                </button>
                              ) : currentBalances[id] >= -0.1 ? (
                                <span className={mutedStatusClass}>
                                  無需付款
                                </span>
                              ) : (
                                <button
                                  onClick={() => toggleMemberSettled(selectedExpense, id)}
                                  className="bg-harbor/10 px-3 py-1.5 rounded-full text-[9px] font-bold text-harbor"
                                >
                                  標記結清
                                </button>
                              )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 flex-shrink-0 pt-2">
              <NordicButton onClick={openEditModal} variant="secondary" className="w-full h-14 bg-harbor text-white border-none"><i className="fa-solid fa-pen-to-square"></i> 修改支出</NordicButton>
              <NordicButton onClick={() => { dbService.updateField('expenses', expenses.filter(e => e.id !== selectedExpense.id)); setShowDetail(false); }} variant="danger" className="w-full h-14 opacity-50 hover:opacity-100"><i className="fa-solid fa-trash-can"></i> 刪除紀錄</NordicButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExpenseView;
