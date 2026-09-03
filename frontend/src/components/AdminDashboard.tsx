import React, { useEffect, useState } from 'react';
import { fetchAdminBalances, fetchOverdueInvoices, fetchAdminProperties, fetchLiveTransactions, createProperty, sendProjectUpdate, fetchAdminApplications, updateApplicationStatus, deleteProperty, updateProperty } from '../services/api';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'properties' | 'transactions' | 'applications'>('overview');
  
  // Overview State
  const [balances, setBalances] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  
  // Properties State
  const [properties, setProperties] = useState<any[]>([]);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState<{show: boolean, propertyId: string | null}>({show: false, propertyId: null});
  
  // Transactions State
  const [transactions, setTransactions] = useState<any[]>([]);

  // Applications State
  const [applications, setApplications] = useState<any[]>([]);

  // Form States
  const [newProperty, setNewProperty] = useState({ type: '', address: '', basePrice: '', description: '', currency: 'GHS' });
  const [formFields, setFormFields] = useState<string[]>(['']);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [updateData, setUpdateData] = useState({ title: '', content: '' });

  // Edit Property State
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editPropertyForm, setEditPropertyForm] = useState({ type: '', address: '', basePrice: '', description: '', currency: 'GHS', status: 'AVAILABLE' });
  const [editSelectedImages, setEditSelectedImages] = useState<File[]>([]);

  const loadApplications = async () => {
    try {
      const data = await fetchAdminApplications();
      setApplications(data);
    } catch (error) {
      console.error('Failed to load applications', error);
    }
  };

  useEffect(() => {
    fetchAdminBalances().then(data => setBalances(data.data)).catch(console.error);
    fetchOverdueInvoices().then(data => setInvoices(data.data)).catch(console.error);
    fetchAdminProperties().then(data => setProperties(data)).catch(console.error);
    fetchLiveTransactions().then(data => setTransactions(data)).catch(console.error);
    loadApplications();
  }, []);

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const requiredFormFields = formFields.filter(f => f.trim() !== '').reduce((acc, field) => {
        acc[field] = 'string'; // Default to string type
        return acc;
      }, {} as any);

      const formData = new FormData();
      formData.append('type', newProperty.type);
      if (newProperty.address) formData.append('address', newProperty.address);
      formData.append('description', newProperty.description);
      formData.append('basePrice', newProperty.basePrice);
      formData.append('currency', newProperty.currency);
      formData.append('requiredFormFields', JSON.stringify(requiredFormFields));
      
      selectedImages.forEach(image => {
        formData.append('images', image);
      });

      await createProperty(formData);
      setShowPropertyModal(false);
      setNewProperty({ type: '', address: '', basePrice: '', description: '', currency: 'GHS' });
      setFormFields(['']);
      setSelectedImages([]);
      // Refresh properties
      const data = await fetchAdminProperties();
      setProperties(data);
    } catch (error: any) {
      console.error('Failed to create property', error);
      alert(error.response?.data?.error || 'Failed to create property: ' + error.message);
    }
  };

  const handleUpdateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPropertyId) return;
    try {
      const formData = new FormData();
      formData.append('type', editPropertyForm.type);
      if (editPropertyForm.address) formData.append('address', editPropertyForm.address);
      formData.append('description', editPropertyForm.description);
      formData.append('basePrice', editPropertyForm.basePrice);
      formData.append('currency', editPropertyForm.currency);
      formData.append('status', editPropertyForm.status);
      
      editSelectedImages.forEach(image => {
        formData.append('images', image);
      });

      await updateProperty(editingPropertyId, formData);
      setEditingPropertyId(null);
      setEditSelectedImages([]);
      const data = await fetchAdminProperties();
      setProperties(data);
      alert('Property updated successfully!');
    } catch (error: any) {
      console.error('Failed to update property', error);
      alert(error.response?.data?.error || 'Failed to update property: ' + error.message);
    }
  };

  const handleSendUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showUpdateModal.propertyId) return;
    try {
      await sendProjectUpdate(showUpdateModal.propertyId, updateData);
      setShowUpdateModal({show: false, propertyId: null});
      setUpdateData({ title: '', content: '' });
      alert("Update sent successfully!");
    } catch (error) {
      console.error('Failed to send update', error);
    }
  };

  const handleUpdateApplication = async (id: string, status: string) => {
    try {
      await updateApplicationStatus(id, status);
      await loadApplications();
    } catch (error) {
      console.error('Failed to update status', error);
      alert('Error updating application status');
    }
  };

  const handleDeleteProperty = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this property? This cannot be undone.")) return;
    try {
      await deleteProperty(id);
      const data = await fetchAdminProperties();
      setProperties(data);
    } catch (error: any) {
      console.error('Failed to delete property', error);
      alert(error.response?.data?.error || 'Failed to delete property');
    }
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
      <section className="glass-panel p-6 rounded-2xl transition-all duration-300 hover:shadow-brand-primary/10 hover:shadow-2xl">
        <h2 className="text-xl font-semibold mb-6 flex items-center text-slate-200">
          <span className="w-2 h-6 bg-brand-primary rounded-full mr-3"></span>
          Active Plans Overview
        </h2>
        <div className="space-y-4">
          {balances.length === 0 ? (
            <p className="text-slate-500 italic">No active plans found.</p>
          ) : (
            balances.map(plan => (
              <div key={plan.planId} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-slate-200">{plan.clientName}</h3>
                  <span className="text-xs px-2 py-1 rounded bg-brand-primary/20 text-brand-primary border border-brand-primary/30">
                    {plan.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-4">{plan.propertyAddress}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-slate-500">Paid to Date</span>
                    <span className="font-semibold text-brand-secondary">GHS {plan.totalPaid.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Remaining</span>
                    <span className="font-semibold text-slate-300">GHS {plan.balanceRemaining.toFixed(2)}</span>
                  </div>
                </div>
                <div className="mt-4 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-brand-primary h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (plan.totalPaid / Number(plan.totalAmount)) * 100)}%` }}
                  ></div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="glass-panel p-6 rounded-2xl transition-all duration-300 hover:shadow-brand-accent/10 hover:shadow-2xl">
        <h2 className="text-xl font-semibold mb-6 flex items-center text-slate-200">
          <span className="w-2 h-6 bg-brand-accent rounded-full mr-3"></span>
          Action Required: Overdue Invoices
        </h2>
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <svg className="w-12 h-12 mb-3 text-brand-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p>All accounts are up to date.</p>
            </div>
          ) : (
            invoices.map(invoice => (
              <div key={invoice.invoiceId} className="flex justify-between items-center p-4 rounded-xl bg-red-950/20 border border-red-900/30 hover:bg-red-950/30 transition-colors">
                <div>
                  <h3 className="font-medium text-red-200">{invoice.clientName}</h3>
                  <p className="text-sm text-red-400/80">Due: {new Date(invoice.dueDate).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <span className="block font-semibold text-red-400">GHS {Number(invoice.amountDue).toFixed(2)}</span>
                  <span className="text-xs text-red-500 font-medium">{invoice.daysOverdue} days overdue</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );

  const renderProperties = () => (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-light text-slate-200">Property Management</h2>
        <button 
          onClick={() => setShowPropertyModal(true)}
          className="bg-brand-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-primary/90 transition shadow-lg shadow-brand-primary/20"
        >
          + Add New Property
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map(property => (
          <div key={property.id} className="glass-panel p-6 rounded-2xl flex flex-col justify-between hover:border-brand-primary/50 transition">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className={`text-xs px-2 py-1 rounded border ${property.status === 'AVAILABLE' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-700/50 text-slate-300 border-slate-600'}`}>
                  {property.status}
                </span>
                <span className="text-sm font-semibold text-brand-secondary">
                  {property.currency === 'USD' ? '$' : property.currency === 'EUR' ? '€' : 'GHS '}{Number(property.basePrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
              </div>
              <h3 className="font-medium text-lg text-slate-100 mb-2">{property.address}</h3>
              <p className="text-slate-400 text-sm mb-4 line-clamp-2">{property.description || 'No description provided.'}</p>
              
              <div className="text-xs text-slate-500 mb-4">
                {property.interests?.length || 0} interests • {property.paymentPlans?.length || 0} active plans
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button 
                onClick={() => setShowUpdateModal({show: true, propertyId: property.id})}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm transition-colors border border-slate-700"
              >
                Project Update
              </button>
              <button 
                onClick={() => {
                  setEditingPropertyId(property.id);
                  setEditPropertyForm({
                    type: property.type || '',
                    address: property.address || '',
                    basePrice: property.basePrice || '',
                    description: property.description || '',
                    currency: property.currency || 'GHS',
                    status: property.status || 'AVAILABLE'
                  });
                }}
                className="py-2 px-3 bg-brand-primary/20 hover:bg-brand-primary/40 text-brand-primary rounded-lg text-sm transition-colors border border-brand-primary/30"
                title="Edit Property"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button 
                onClick={() => handleDeleteProperty(property.id)}
                className="py-2 px-3 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg text-sm transition-colors border border-red-900/50"
                title="Delete Property"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {editingPropertyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-xl p-6 rounded-2xl border border-slate-700 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-medium text-slate-100 mb-6">Edit Property</h3>
            <form onSubmit={handleUpdateProperty} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                <select 
                  className="w-full p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary"
                  value={editPropertyForm.status}
                  onChange={e => setEditPropertyForm({...editPropertyForm, status: e.target.value})}
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="SOLD">SOLD</option>
                  <option value="RENTED">RENTED</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Type of Property</label>
                <input required type="text" className="w-full p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary" value={editPropertyForm.type} onChange={e => setEditPropertyForm({...editPropertyForm, type: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Property Address</label>
                <input type="text" className="w-full p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary" value={editPropertyForm.address} onChange={e => setEditPropertyForm({...editPropertyForm, address: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea className="w-full p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary" rows={3} value={editPropertyForm.description} onChange={e => setEditPropertyForm({...editPropertyForm, description: e.target.value})}></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Base Price</label>
                <div className="flex gap-2">
                  <select 
                    className="w-1/3 p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary"
                    value={editPropertyForm.currency}
                    onChange={e => setEditPropertyForm({...editPropertyForm, currency: e.target.value})}
                  >
                    <option value="GHS">GHS (₵)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                  <input required type="number" className="w-2/3 p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary" value={editPropertyForm.basePrice} onChange={e => setEditPropertyForm({...editPropertyForm, basePrice: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Upload Additional Images</label>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*"
                  onChange={e => {
                    if (e.target.files) {
                      setEditSelectedImages(Array.from(e.target.files));
                    }
                  }}
                  className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => { setEditingPropertyId(null); setEditSelectedImages([]); }} className="px-5 py-2 text-slate-300 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="bg-brand-primary text-white px-5 py-2 rounded-lg font-medium hover:bg-brand-primary/90 transition shadow-lg shadow-brand-primary/20">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPropertyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-xl p-6 rounded-2xl border border-slate-700 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-medium text-slate-100 mb-6">Create New Property</h3>
            <form onSubmit={handleCreateProperty} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Type of Property</label>
                <input required type="text" className="w-full p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary" value={newProperty.type} onChange={e => setNewProperty({...newProperty, type: e.target.value})} placeholder="e.g. 1-Bedroom Apartment" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Property Address (Optional)</label>
                <input type="text" className="w-full p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary" value={newProperty.address} onChange={e => setNewProperty({...newProperty, address: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea className="w-full p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary" rows={3} value={newProperty.description} onChange={e => setNewProperty({...newProperty, description: e.target.value})}></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Base Price</label>
                <div className="flex gap-2">
                  <select 
                    className="w-1/3 p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary"
                    value={newProperty.currency}
                    onChange={e => setNewProperty({...newProperty, currency: e.target.value})}
                  >
                    <option value="GHS">GHS (₵)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                  <input required type="number" className="w-2/3 p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary" value={newProperty.basePrice} onChange={e => setNewProperty({...newProperty, basePrice: e.target.value})} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Property Images</label>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*"
                  className="w-full p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 focus:outline-none focus:border-brand-primary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30"
                  onChange={e => {
                    if (e.target.files) {
                      setSelectedImages(Array.from(e.target.files));
                    }
                  }}
                />
                {selectedImages.length > 0 && (
                  <p className="mt-2 text-xs text-brand-accent">{selectedImages.length} file(s) selected</p>
                )}
              </div>
              
              <div className="flex gap-3 justify-end mt-8 pt-4">
                <button type="button" onClick={() => setShowPropertyModal(false)} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors shadow-lg shadow-brand-primary/20">Create Property</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUpdateModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-700 shadow-2xl relative">
            <h3 className="text-xl font-medium text-slate-100 mb-6">Send Project Update</h3>
            <p className="text-sm text-slate-400 mb-4">This will email all clients interested in or currently paying for this property.</p>
            <form onSubmit={handleSendUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Update Title</label>
                <input required type="text" className="w-full p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary" value={updateData.title} onChange={e => setUpdateData({...updateData, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Message Content</label>
                <textarea required className="w-full p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary" rows={5} value={updateData.content} onChange={e => setUpdateData({...updateData, content: e.target.value})}></textarea>
              </div>
              
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowUpdateModal({show: false, propertyId: null})} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors shadow-lg shadow-brand-primary/20">Send Email Update</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const renderTransactions = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-light text-slate-200 mb-6">Live Transactions</h2>
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-700/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-800/80 border-b border-slate-700/80">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Date</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Client</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Type</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-right">Amount (GHS)</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">No recent transactions found.</td></tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-slate-700/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-400 group-hover:text-slate-300">
                      {new Date(tx.transactionDate).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {tx.paymentPlan?.client?.name || 'Unknown Client'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs rounded-full border font-medium ${tx.type === 'PAYMENT' ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30' : 'bg-slate-800 text-slate-300 border-slate-600'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-200">
                      {Number(tx.amountGHS).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderApplications = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-light text-slate-200 mb-6">Client Applications</h2>
      <div className="grid grid-cols-1 gap-6">
        {applications.length === 0 ? (
          <p className="text-slate-500 italic">No applications found.</p>
        ) : (
          applications.map(app => (
            <div key={app.id} className="glass-panel p-6 rounded-2xl border border-slate-700/50 flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-slate-100">{app.client.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded border ${
                    app.status === 'APPROVED' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                    app.status === 'REJECTED' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                    app.status === 'CANCELLED' ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' :
                    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  }`}>
                    {app.status}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mb-4">Applied for: <span className="text-brand-accent">{app.property.address}</span></p>
                
                <div className="bg-slate-900/50 rounded-xl p-4 text-sm border border-slate-800 max-h-96 overflow-y-auto">
                  <h4 className="text-slate-300 font-medium mb-3 border-b border-slate-700 pb-2">Application Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(app.submittedData || {}).map(([key, value]) => (
                      <div key={key}>
                        <span className="block text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-slate-300 font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {app.status === 'PENDING' && (
                <div className="flex flex-col gap-3 min-w-[140px] pt-2">
                  <button 
                    onClick={() => handleUpdateApplication(app.id, 'APPROVED')}
                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleUpdateApplication(app.id, 'REJECTED')}
                    className="bg-slate-800 hover:bg-red-600 hover:text-white text-red-400 border border-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    Reject
                  </button>
                </div>
              )}
              
              {app.status === 'APPROVED' && (
                <div className="flex flex-col gap-3 min-w-[140px] pt-2">
                  <button 
                    onClick={() => {
                      if (window.confirm('Are you sure you want to cancel and release this application?')) {
                        handleUpdateApplication(app.id, 'CANCELLED');
                      }
                    }}
                    className="bg-slate-800 hover:bg-red-600/20 hover:text-red-400 text-slate-300 border border-transparent hover:border-red-900 px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    Cancel / Release
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 pb-6 border-b border-slate-700/50">
          <div>
            <h1 className="text-3xl font-light text-slate-100 tracking-wide">
              Cereno<span className="font-semibold text-brand-primary">Homes</span>
            </h1>
            <p className="text-slate-400 mt-1">Platform Administration Dashboard</p>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex flex-wrap bg-slate-800/40 p-1.5 rounded-xl border border-slate-700/50 shadow-inner">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'properties', label: 'Properties' },
              { id: 'applications', label: 'Applications' },
              { id: 'transactions', label: 'Transactions' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === tab.id ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="mt-8">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'properties' && renderProperties()}
          {activeTab === 'applications' && renderApplications()}
          {activeTab === 'transactions' && renderTransactions()}
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
