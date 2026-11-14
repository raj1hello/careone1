import { useEffect, useState, type FormEvent } from 'react';
import { Activity, AlertTriangle, ClipboardCheck, PackagePlus, Pill } from 'lucide-react';
import { api, getApiErrorMessage } from '../services/api.ts';
import { PortalLayout, type NavItem } from '../components/PortalLayout.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';

const PHARMACY_NAV: NavItem[] = [
  { id: 'overview', label: 'Overview & Alerts', icon: Activity },
  { id: 'orders', label: 'Orders & Rx', icon: ClipboardCheck },
  { id: 'inventory', label: 'Inventory', icon: Pill },
];

export function PharmacyPortal() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [data, setData] = useState<any>(null);

  const [name, setName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [category, setCategory] = useState('Cardiovascular');
  const [batchNumber, setBatchNumber] = useState('');
  const [unitPrice, setUnitPrice] = useState('120');
  const [stockQty, setStockQty] = useState('100');
  const [reorderLevel, setReorderLevel] = useState('25');
  const [expiryDate, setExpiryDate] = useState('2027-12-31');
  const [requiresRx, setRequiresRx] = useState(true);

  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});

  const loadAll = async () => {
    setLoading(true);
    try {
      const res = await api.get('/pharmacies/dashboard');
      setData(res.data);
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleAddMedicine = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await api.post('/pharmacies/medicines', {
        name,
        generic_name: genericName,
        category,
        batch_number: batchNumber,
        unit_price: Number(unitPrice),
        stock_quantity: Number(stockQty),
        reorder_level: Number(reorderLevel),
        expiry_date: expiryDate,
        requires_prescription: requiresRx,
      });
      setName('');
      setGenericName('');
      setBatchNumber('');
      setFeedback({ type: 'ok', text: 'Medicine added' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleRestock = async (medId: number, currentStock: number, delta: number) => {
    try {
      await api.patch(`/pharmacies/medicines/${medId}`, {
        stock_quantity: Math.max(0, currentStock + delta),
      });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleOrderStatus = async (
    orderId: number,
    status: 'verified' | 'rejected' | 'preparing' | 'dispatched' | 'delivered'
  ) => {
    setFeedback(null);
    try {
      await api.patch(`/pharmacies/orders/${orderId}/status`, {
        status,
        rejection_reason: status === 'rejected' ? rejectReasons[orderId] || 'Prescription mismatch' : undefined,
      });
      setFeedback({ type: 'ok', text: `Order #${orderId} ${status}` });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  return (
    <PortalLayout
      portalTitle="Pharmacy Portal"
      portalSubtitle={data?.pharmacy ? `${data.pharmacy.name}` : ''}
      navItems={PHARMACY_NAV}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {feedback && (
        <div
          className={`mb-5 px-4 py-3 rounded-xl border text-[13px] font-medium flex items-center justify-between ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-[#15803d]'
              : 'border-red-200 bg-red-50 text-[#dc2626]'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-[12px] underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 glass-card animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {activeTab === 'overview' && data && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card">
                  <p className="text-[12px] font-medium text-[#6e6e73]">Pending Orders</p>
                  <p className="mt-1.5 text-[34px] leading-none font-semibold font-mono-tabular text-[#0071e3]">
                    {data.stats.pending_orders}
                  </p>
                </div>
                <div className="glass-card">
                  <p className="text-[12px] font-medium text-[#6e6e73]">Low Stock</p>
                  <p className="mt-1.5 text-[34px] leading-none font-semibold font-mono-tabular text-[#b45309]">
                    {data.stats.low_stock_count}
                  </p>
                </div>
                <div className="glass-card">
                  <p className="text-[12px] font-medium text-[#6e6e73]">Expiring &le; 90d</p>
                  <p className="mt-1.5 text-[34px] leading-none font-semibold font-mono-tabular text-[#dc2626]">
                    {data.stats.expiring_soon_count}
                  </p>
                </div>
                <div className="glass-card">
                  <p className="text-[12px] font-medium text-[#6e6e73]">Verified Sales</p>
                  <p className="mt-1.5 text-[28px] leading-none font-semibold font-mono-tabular text-[#15803d]">
                    INR {data.stats.total_sales.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card space-y-3">
                  <div className="flex items-center gap-2 text-[#b45309]">
                    <AlertTriangle className="w-4 h-4" />
                    <h2 className="text-[16px] font-semibold text-[#1d1d1f]">Low Stock</h2>
                  </div>
                  {data.lowStockAlerts.length === 0 ? (
                    <p className="text-[13px] text-[#6e6e73]">Stock healthy</p>
                  ) : (
                    <div className="divide-y divide-black/[0.06]">
                      {data.lowStockAlerts.map((m: any) => (
                        <div key={m.id} className="py-3 flex items-center justify-between text-[13px]">
                          <div>
                            <p className="font-semibold text-[#1d1d1f]">{m.name}</p>
                            <p className="text-[12px] text-[#b45309] font-mono-tabular">
                              {m.stock_quantity} left (min {m.reorder_level})
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRestock(m.id, m.stock_quantity, 50)}
                            className="mac-btn-primary px-3 py-1.5 text-[12px]"
                          >
                            +50
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="glass-card space-y-3">
                  <div className="flex items-center gap-2 text-[#dc2626]">
                    <AlertTriangle className="w-4 h-4" />
                    <h2 className="text-[16px] font-semibold text-[#1d1d1f]">Near Expiry</h2>
                  </div>
                  {data.expiringAlerts.length === 0 ? (
                    <p className="text-[13px] text-[#6e6e73]">No expiring batches</p>
                  ) : (
                    <div className="divide-y divide-black/[0.06]">
                      {data.expiringAlerts.map((m: any) => (
                        <div key={m.id} className="py-3 flex items-center justify-between text-[13px]">
                          <div>
                            <p className="font-semibold text-[#1d1d1f]">{m.name}</p>
                            <p className="text-[12px] text-[#6e6e73] font-mono-tabular">{m.batch_number}</p>
                          </div>
                          <span className="font-mono-tabular text-[12px] text-[#dc2626]">{m.expiry_date}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && data && (
            <div className="space-y-4">
              <h2 className="text-[18px] font-semibold text-[#1d1d1f]">Orders</h2>
              {data.orders.map((order: any) => (
                <div key={order.id} className="glass-card space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold text-[#1d1d1f] font-mono-tabular">
                        Order #{order.id} · {order.patient_name} ({order.mrn})
                      </p>
                      <p className="text-[12px] text-[#6e6e73] mt-0.5">
                        {order.delivery_address} · <span className="uppercase">{order.payment_status}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono-tabular text-[15px] font-semibold text-[#1d1d1f]">
                        INR {order.total_amount}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-black/[0.06]">
                    <div>
                      <p className="text-[12px] font-medium text-[#6e6e73] mb-1.5">Items</p>
                      <ul className="space-y-1 text-[13px] text-[#1d1d1f]">
                        {(order.items || []).map((i: any) => (
                          <li key={i.id} className="flex justify-between font-mono-tabular">
                            <span>{i.medicine_name}</span>
                            <span>
                              x{i.quantity} · INR {i.subtotal}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="text-[12px] font-medium text-[#0071e3] mb-1.5">
                        {order.prescription_id ? `Rx #${order.prescription_id} (${order.doctor_name})` : 'OTC Order'}
                      </p>
                      {order.prescription_items ? (
                        <ul className="space-y-1 text-[13px] text-[#6e6e73]">
                          {order.prescription_items.map((pi: any) => (
                            <li key={pi.id}>
                              {pi.medicine_name} · {pi.dosage} · {pi.frequency}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[12px] text-[#86868b]">No prescription attached</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    {order.status === 'pending' && (
                      <div className="flex flex-wrap items-center gap-2.5 w-full justify-between">
                        <input
                          placeholder="Rejection reason..."
                          value={rejectReasons[order.id] || ''}
                          onChange={(e) => setRejectReasons({ ...rejectReasons, [order.id]: e.target.value })}
                          className="glass-input flex-1 min-w-[200px] px-3 py-2 text-[13px]"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOrderStatus(order.id, 'verified')}
                            className="mac-btn-primary px-4 py-2 text-[12px]"
                          >
                            Verify & Deduct
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOrderStatus(order.id, 'rejected')}
                            className="mac-btn-secondary px-3.5 py-2 text-[12px] text-[#dc2626]"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                    {['verified', 'preparing', 'dispatched'].includes(order.status) && (
                      <div className="flex items-center gap-2 ml-auto">
                        {order.status === 'verified' && (
                          <button
                            type="button"
                            onClick={() => handleOrderStatus(order.id, 'preparing')}
                            className="mac-btn-secondary px-3.5 py-1.5 text-[12px]"
                          >
                            Preparing
                          </button>
                        )}
                        {order.status !== 'dispatched' && (
                          <button
                            type="button"
                            onClick={() => handleOrderStatus(order.id, 'dispatched')}
                            className="mac-btn-secondary px-3.5 py-1.5 text-[12px] text-[#0071e3]"
                          >
                            Dispatch
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOrderStatus(order.id, 'delivered')}
                          className="mac-btn-primary px-3.5 py-1.5 text-[12px]"
                        >
                          Delivered
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'inventory' && data && (
            <div className="space-y-6">
              <form onSubmit={handleAddMedicine} className="glass-card space-y-4">
                <div className="flex items-center gap-2">
                  <PackagePlus className="w-4 h-4 text-[#0071e3]" />
                  <h2 className="text-[16px] font-semibold text-[#1d1d1f]">Add Medicine</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Medicine Name"
                    className="glass-input px-3 py-2 text-[13px]"
                  />
                  <input
                    value={genericName}
                    onChange={(e) => setGenericName(e.target.value)}
                    placeholder="Generic Name"
                    className="glass-input px-3 py-2 text-[13px]"
                  />
                  <input
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Category"
                    className="glass-input px-3 py-2 text-[13px]"
                  />
                  <input
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="Batch #"
                    className="glass-input px-3 py-2 text-[13px] font-mono-tabular"
                  />
                  <input
                    type="number"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="Price (INR)"
                    className="glass-input px-3 py-2 text-[13px] font-mono-tabular"
                  />
                  <input
                    type="number"
                    required
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    placeholder="Stock"
                    className="glass-input px-3 py-2 text-[13px] font-mono-tabular"
                  />
                  <input
                    type="number"
                    required
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    placeholder="Reorder Min"
                    className="glass-input px-3 py-2 text-[13px] font-mono-tabular"
                  />
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="glass-input px-3 py-2 text-[13px] font-mono-tabular"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-[13px] text-[#1d1d1f]">
                    <input
                      type="checkbox"
                      checked={requiresRx}
                      onChange={(e) => setRequiresRx(e.target.checked)}
                      className="accent-[#0071e3]"
                    />
                    <span>Requires Prescription</span>
                  </label>
                  <button type="submit" className="mac-btn-primary px-5 py-2 text-[13px]">
                    Add SKU
                  </button>
                </div>
              </form>

              <div className="glass-card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-black/[0.025] text-[12px] text-[#6e6e73]">
                      <tr>
                        <th className="px-5 py-3 font-medium">Medicine</th>
                        <th className="px-5 py-3 font-medium">Category & Batch</th>
                        <th className="px-5 py-3 font-medium">Expiry</th>
                        <th className="px-5 py-3 font-medium">Price</th>
                        <th className="px-5 py-3 font-medium">Stock</th>
                        <th className="px-5 py-3 font-medium text-right">Restock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.06]">
                      {data.medicines.map((m: any) => (
                        <tr key={m.id} className="hover:bg-black/[0.02]">
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-[#1d1d1f]">{m.name}</p>
                            <p className="text-[12px] text-[#6e6e73]">{m.generic_name}</p>
                          </td>
                          <td className="px-5 py-3.5 text-[#6e6e73]">
                            {m.category} · <span className="font-mono-tabular">{m.batch_number}</span>
                          </td>
                          <td className="px-5 py-3.5 font-mono-tabular text-[#1d1d1f]">{m.expiry_date}</td>
                          <td className="px-5 py-3.5 font-mono-tabular text-[#1d1d1f]">INR {m.unit_price}</td>
                          <td className="px-5 py-3.5 font-mono-tabular text-[#1d1d1f]">
                            {m.stock_quantity} (min {m.reorder_level})
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRestock(m.id, m.stock_quantity, 25)}
                              className="mac-btn-secondary px-3 py-1 text-[12px]"
                            >
                              +25
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PortalLayout>
  );
}
