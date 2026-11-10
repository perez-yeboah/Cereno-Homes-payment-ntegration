import React, { useEffect, useState } from 'react';
import { 
  fetchAdminBalances, 
  fetchOverdueInvoices, 
  fetchAdminProperties, 
  fetchLiveTransactions, 
  createProperty, 
  sendProjectUpdate, 
  fetchAdminApplications, 
  updateApplicationStatus, 
  deleteProperty, 
  updateProperty,
  fetchAllInvoices,
  createInvoicePaymentLink,
  regenerateInvoicePaymentLink,
  splitInvoice,
  recordManualPayment,
  downloadPaymentReceipt
} from '../services/api';
import { useToast } from '../context/ToastContext';

const AdminDashboard: React.FC = () => {
  const { showToast } = useToast();

  const formatCurrency = (amount: number | string, currency: string = 'USD') => {
    const num = Number(amount) || 0;
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GHS' ? '₵' : `${currency} `;
    return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'properties' | 'transactions' | 'invoices' | 'applications'>('overview');
  
  // Overview State
  const [balances, setBalances] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Transactions / Payments State
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionProviderFilter, setTransactionProviderFilter] = useState<'ALL' | 'STRIPE' | 'MANUAL_WIRE'>('ALL');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'ALL' | 'PAYMENT' | 'RENT_DEDUCTION' | 'PENALTY'>('ALL');
  const [showManualWireModal, setShowManualWireModal] = useState(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);
  const [manualWireForm, setManualWireForm] = useState({
    paymentPlanId: '',
    amount: '',
    reference: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Invoices & Payment Links State
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'UNPAID' | 'PAID' | 'OVERDUE'>('ALL');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [generatingLinkId, setGeneratingLinkId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [generatedLinkResult, setGeneratedLinkResult] = useState<{ url: string; invoiceId: string; clientName: string; amount: number; currency?: string } | null>(null);
  const [newInvoiceForm, setNewInvoiceForm] = useState({
    paymentPlanId: '',
    amount: '',
    dueDate: '',
    description: '',
    sendEmail: true
  });
  const [splitTargetInvoice, setSplitTargetInvoice] = useState<any>(null);
  const [trancheCount, setTrancheCount] = useState<number>(2);
  const [isSplitting, setIsSplitting] = useState<boolean>(false);
  
  // Properties State
  const [properties, setProperties] = useState<any[]>([]);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState<{show: boolean, propertyId: string | null}>({show: false, propertyId: null});
  
  // Transactions State
  const [transactions, setTransactions] = useState<any[]>([]);

  // Applications State
  const [applications, setApplications] = useState<any[]>([]);

  // Form States
  const [newProperty, setNewProperty] = useState({ type: '', address: '', basePrice: '', description: '', currency: 'USD' });
  const [formFields, setFormFields] = useState<string[]>(['']);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [updateData, setUpdateData] = useState({ title: '', content: '' });

  // Edit Property State
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editPropertyForm, setEditPropertyForm] = useState({ type: '', address: '', basePrice: '', description: '', currency: 'USD', status: 'AVAILABLE' });
  const [editSelectedImages, setEditSelectedImages] = useState<File[]>([]);

  const loadApplications = async () => {
    try {
      const data = await fetchAdminApplications();
      setApplications(data);
    } catch (error) {
      console.error('Failed to load applications', error);
    }
  };

  const loadAllInvoices = async () => {
    setIsLoadingInvoices(true);
    try {
      const data = await fetchAllInvoices();
      setAllInvoices(data);
    } catch (error) {
      console.error('Failed to load invoices', error);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoiceForm.paymentPlanId || !newInvoiceForm.amount || !newInvoiceForm.dueDate) {
      showToast('Validation Error', 'Please fill in all required fields.', 'warning');
      return;
    }

    try {
      const result = await createInvoicePaymentLink({
        paymentPlanId: newInvoiceForm.paymentPlanId,
        amount: Number(newInvoiceForm.amount),
        dueDate: newInvoiceForm.dueDate,
        description: newInvoiceForm.description,
        sendEmail: newInvoiceForm.sendEmail,
      });

      const plan = balances.find(b => b.planId === newInvoiceForm.paymentPlanId);
      setGeneratedLinkResult({
        url: result.paymentLink,
        invoiceId: result.invoice.id,
        clientName: plan?.clientName || result.invoice.clientName || 'Client',
        amount: Number(newInvoiceForm.amount),
        currency: plan?.currency || result.currency || 'USD',
      });

      setShowInvoiceModal(false);
      setNewInvoiceForm({
        paymentPlanId: '',
        amount: '',
        dueDate: '',
        description: '',
        sendEmail: true,
      });

      await loadAllInvoices();
      fetchOverdueInvoices().then(data => setInvoices(data.data)).catch(console.error);
    } catch (error: any) {
      console.error('Failed to create invoice payment link', error);
      showToast('Invoice Creation Error', error.response?.data?.error || error.message || 'Failed to create invoice payment link', 'error');
    }
  };

  const handleGenerateLinkForExisting = async (invoiceId: string, sendEmail: boolean = false) => {
    const targetInv = allInvoices.find(i => i.id === invoiceId);
    if (targetInv && Number(targetInv.amountDue) > 999999.99) {
      showToast('Stripe Limit Exceeded', `This invoice of ${formatCurrency(targetInv.amountDue, targetInv.currency)} exceeds Stripe's $999,999.99 single payment limit. Please click 'Split Tranches' to divide it into milestone installments.`, 'warning');
      setSplitTargetInvoice(targetInv);
      setTrancheCount(Math.ceil(Number(targetInv.amountDue) / 900000));
      return;
    }

    setGeneratingLinkId(invoiceId);
    try {
      const result = await regenerateInvoicePaymentLink(invoiceId, sendEmail);
      if (result.paymentLink) {
        await navigator.clipboard.writeText(result.paymentLink);
        setCopiedLinkId(invoiceId);
        setTimeout(() => setCopiedLinkId(null), 3000);
        if (sendEmail) {
          showToast('Payment Link Ready', 'Payment link copied to clipboard and emailed to client!', 'success');
        } else {
          showToast('Copied', 'Stripe payment link copied to clipboard!', 'success');
        }
      }
    } catch (error: any) {
      console.error('Failed to generate link for invoice', error);
      showToast('Link Generation Error', error.response?.data?.error || error.message || 'Failed to generate link', 'error');
    } finally {
      setGeneratingLinkId(null);
    }
  };

  const handleSplitInvoice = async () => {
    if (!splitTargetInvoice) return;
    setIsSplitting(true);
    try {
      await splitInvoice(splitTargetInvoice.id, trancheCount);
      showToast('Invoice Split Successfully', `Invoice split into ${trancheCount} tranches. New payment links can now be generated for each tranche.`, 'success');
      setSplitTargetInvoice(null);
      await loadAllInvoices();
      fetchOverdueInvoices().then(data => setInvoices(data.data)).catch(console.error);
    } catch (error: any) {
      console.error('Failed to split invoice', error);
      showToast('Split Error', error.response?.data?.error || error.message || 'Failed to split invoice', 'error');
    } finally {
      setIsSplitting(false);
    }
  };

  const handleCopyLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkId(id);
      setTimeout(() => setCopiedLinkId(null), 3000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const loadTransactions = async () => {
    setIsLoadingTransactions(true);
    try {
      const data = await fetchLiveTransactions();
      setTransactions(data);
    } catch (err) {
      console.error('Failed to load transactions', err);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const handleRecordManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualWireForm.paymentPlanId || !manualWireForm.amount) {
      showToast('Missing Fields', 'Please select a client payment plan and specify the amount.', 'warning');
      return;
    }

    try {
      const plan = balances.find(b => b.planId === manualWireForm.paymentPlanId);
      await recordManualPayment({
        paymentPlanId: manualWireForm.paymentPlanId,
        amountGHS: Number(manualWireForm.amount),
        originalCurrency: plan?.currency || 'USD',
        originalAmount: Number(manualWireForm.amount),
        reference: manualWireForm.reference || `WIRE-${Date.now()}`,
        date: manualWireForm.date || new Date().toISOString(),
      });

      setShowManualWireModal(false);
      setManualWireForm({
        paymentPlanId: '',
        amount: '',
        reference: '',
        date: new Date().toISOString().split('T')[0]
      });
      showToast('Payment Recorded', 'Bank wire payment recorded and ledger updated successfully!', 'success');

      await loadTransactions();
      fetchAdminBalances().then(data => setBalances(data.data)).catch(console.error);
    } catch (error: any) {
      console.error('Failed to record manual payment', error);
      showToast('Manual Payment Error', error.response?.data?.error || error.message || 'Failed to record manual payment', 'error');
    }
  };

  const handleDownloadReceipt = async (paymentId: string) => {
    setDownloadingReceiptId(paymentId);
    try {
      await downloadPaymentReceipt(paymentId);
      showToast('Receipt Downloaded', 'PDF payment receipt downloaded successfully.', 'success');
    } catch (error: any) {
      console.error('Failed to download receipt', error);
      showToast('Receipt Download Failed', error.message || 'Failed to download receipt', 'error');
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const handleCopyReference = async (ref: string, id: string) => {
    try {
      await navigator.clipboard.writeText(ref);
      setCopiedRefId(id);
      setTimeout(() => setCopiedRefId(null), 3000);
    } catch (err) {
      console.error('Failed to copy reference', err);
    }
  };

  useEffect(() => {
    fetchAdminBalances().then(data => setBalances(data.data)).catch(console.error);
    fetchOverdueInvoices().then(data => setInvoices(data.data)).catch(console.error);
    fetchAdminProperties().then(data => setProperties(data)).catch(console.error);
    loadTransactions();
    loadApplications();
    loadAllInvoices();
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
      setNewProperty({ type: '', address: '', basePrice: '', description: '', currency: 'USD' });
      setFormFields(['']);
      setSelectedImages([]);
      // Refresh properties
      const data = await fetchAdminProperties();
      setProperties(data);
    } catch (error: any) {
      console.error('Failed to create property', error);
      showToast('Creation Failed', error.response?.data?.error || error.message || 'Failed to create property', 'error');
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
      showToast('Property Updated', 'Property updated successfully!', 'success');
    } catch (error: any) {
      console.error('Failed to update property', error);
      showToast('Update Failed', error.response?.data?.error || error.message || 'Failed to update property', 'error');
    }
  };

  const handleSendUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showUpdateModal.propertyId) return;
    try {
      await sendProjectUpdate(showUpdateModal.propertyId, updateData);
      setShowUpdateModal({show: false, propertyId: null});
      setUpdateData({ title: '', content: '' });
      showToast('Update Broadcasted', 'Project update sent successfully!', 'success');
    } catch (error: any) {
      console.error('Failed to send update', error);
      showToast('Broadcast Failed', error.message || 'Failed to send update', 'error');
    }
  };

  const handleUpdateApplication = async (id: string, status: string) => {
    try {
      await updateApplicationStatus(id, status);
      await loadApplications();
      showToast('Application Updated', `Application status changed to ${status}.`, 'info');
    } catch (error: any) {
      console.error('Failed to update status', error);
      showToast('Status Error', error.response?.data?.error || 'Error updating application status', 'error');
    }
  };

  const handleDeleteProperty = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this property? This cannot be undone.")) return;
    try {
      await deleteProperty(id);
      const data = await fetchAdminProperties();
      setProperties(data);
      showToast('Property Deleted', 'Property has been permanently deleted.', 'info');
    } catch (error: any) {
      console.error('Failed to delete property', error);
      showToast('Delete Failed', error.response?.data?.error || 'Failed to delete property', 'error');
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
                    <span className="font-semibold text-brand-secondary">
                      {plan.currency === 'USD' ? '$' : plan.currency === 'EUR' ? '€' : plan.currency === 'GHS' ? '₵' : `${plan.currency || 'USD'} `}
                      {plan.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Remaining</span>
                    <span className="font-semibold text-slate-300">
                      {plan.currency === 'USD' ? '$' : plan.currency === 'EUR' ? '€' : plan.currency === 'GHS' ? '₵' : `${plan.currency || 'USD'} `}
                      {plan.balanceRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
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
                  <span className="block font-semibold text-red-400">
                    {invoice.currency === 'USD' ? '$' : invoice.currency === 'EUR' ? '€' : invoice.currency === 'GHS' ? '₵' : `${invoice.currency || 'USD'} `}
                    {Number(invoice.amountDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
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
                  {property.currency === 'USD' ? '$' : property.currency === 'EUR' ? '€' : property.currency === 'GHS' ? '₵' : '$'}{Number(property.basePrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
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
                    currency: property.currency || 'USD',
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
                    <option value="USD">USD ($)</option>
                    <option value="GHS">GHS (₵)</option>
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
                    <option value="USD">USD ($)</option>
                    <option value="GHS">GHS (₵)</option>
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

  const filteredTransactions = transactions.filter((tx) => {
    // Search query filter
    if (transactionSearch.trim()) {
      const q = transactionSearch.toLowerCase();
      const clientName = tx.paymentPlan?.client?.name?.toLowerCase() || '';
      const clientEmail = tx.paymentPlan?.client?.email?.toLowerCase() || '';
      const address = tx.paymentPlan?.property?.address?.toLowerCase() || '';
      const ref = tx.payment?.providerTransactionId?.toLowerCase() || '';
      if (!clientName.includes(q) && !clientEmail.includes(q) && !address.includes(q) && !ref.includes(q)) {
        return false;
      }
    }

    // Provider filter
    if (transactionProviderFilter !== 'ALL') {
      const prov = tx.payment?.provider?.toUpperCase() || 'INTERNAL';
      if (transactionProviderFilter === 'STRIPE' && !prov.includes('STRIPE')) return false;
      if (transactionProviderFilter === 'MANUAL_WIRE' && !prov.includes('MANUAL') && !prov.includes('WIRE')) return false;
    }

    // Type filter
    if (transactionTypeFilter !== 'ALL') {
      if (tx.type !== transactionTypeFilter) return false;
    }

    return true;
  });

  // Calculate statistics
  const totalVolume = transactions
    .filter(t => t.type === 'PAYMENT')
    .reduce((sum, t) => sum + Number(t.amountGHS), 0);

  const stripeVolume = transactions
    .filter(t => t.type === 'PAYMENT' && t.payment?.provider?.toUpperCase().includes('STRIPE'))
    .reduce((sum, t) => sum + Number(t.amountGHS), 0);

  const wireVolume = transactions
    .filter(t => t.type === 'PAYMENT' && (t.payment?.provider?.toUpperCase().includes('MANUAL') || t.payment?.provider?.toUpperCase().includes('WIRE')))
    .reduce((sum, t) => sum + Number(t.amountGHS), 0);

  const renderTransactions = () => (
    <div className="animate-fade-in space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-light text-slate-200">Client Payments & Transactions Ledger</h2>
          <p className="text-sm text-slate-400 mt-1">
            Real-time audit log of all online Stripe payments, bank wire transfers, and account ledger entries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadTransactions()}
            disabled={isLoadingTransactions}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Refresh Transactions"
          >
            <svg className={`w-4 h-4 ${isLoadingTransactions ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button 
            onClick={() => setShowManualWireModal(true)}
            className="bg-brand-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-primary/90 transition shadow-lg shadow-brand-primary/20 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Record Bank Wire Transfer
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-700/50">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block mb-1">Total Processed Volume</span>
          <div className="text-2xl font-bold text-slate-100">
            ₵{totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Total client payments received</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-indigo-500/20 bg-indigo-950/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-indigo-400 font-medium uppercase tracking-wider">Stripe Payments</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">STRIPE</span>
          </div>
          <div className="text-2xl font-bold text-indigo-400">
            ₵{stripeVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            {transactions.filter(t => t.payment?.provider?.toUpperCase().includes('STRIPE')).length} online transactions
          </span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-400 font-medium uppercase tracking-wider">Bank Wire Transfers</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">WIRE</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            ₵{wireVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            {transactions.filter(t => t.payment?.provider?.toUpperCase().includes('MANUAL') || t.payment?.provider?.toUpperCase().includes('WIRE')).length} manual entries
          </span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-700/50">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block mb-1">Ledger Activity</span>
          <div className="text-2xl font-bold text-slate-100">{transactions.length}</div>
          <span className="text-xs text-slate-500 mt-1 block">Total financial events recorded</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <svg className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search by client, property, or reference..."
            value={transactionSearch}
            onChange={(e) => setTransactionSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-brand-primary placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Provider Filter */}
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/60">
            {(['ALL', 'STRIPE', 'MANUAL_WIRE'] as const).map(prov => (
              <button
                key={prov}
                onClick={() => setTransactionProviderFilter(prov)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                  transactionProviderFilter === prov
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {prov === 'ALL' ? 'All Channels' : prov === 'STRIPE' ? 'Stripe' : 'Bank Wire'}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/60">
            {(['ALL', 'PAYMENT', 'RENT_DEDUCTION', 'PENALTY'] as const).map(type => (
              <button
                key={type}
                onClick={() => setTransactionTypeFilter(type)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                  transactionTypeFilter === type
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type === 'ALL' ? 'All Types' : type === 'RENT_DEDUCTION' ? 'Rent' : type === 'PAYMENT' ? 'Payments' : 'Penalties'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/60 border-b border-slate-700/50">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Date & Time</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Client & Property</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Channel & Reference</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Type</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-right">Amount</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {isLoadingTransactions ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading transactions...</td></tr>
              ) : filteredTransactions.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">No transactions matched your filters.</td></tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const provider = tx.payment?.provider?.toUpperCase() || (tx.paymentId ? 'STRIPE' : 'LEDGER');
                  const reference = tx.payment?.providerTransactionId || tx.id;
                  const isStripe = provider.includes('STRIPE');
                  const isWire = provider.includes('MANUAL') || provider.includes('WIRE');
                  
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-slate-200">{new Date(tx.transactionDate).toLocaleDateString()}</div>
                        <div className="text-xs text-slate-500">{new Date(tx.transactionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-100 flex items-center gap-2">
                          {tx.paymentPlan?.client?.name || 'Unknown Client'}
                          {tx.paymentPlan?.type && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {tx.paymentPlan.type === 'RENT_TO_OWN' ? 'Rent-to-Own' : 'Pay-to-Own'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{tx.paymentPlan?.property?.address || 'Property'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{tx.paymentPlan?.client?.email}</div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 mb-1">
                          {isStripe ? (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                              Stripe
                            </span>
                          ) : isWire ? (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              Bank Wire
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700/40 text-slate-300 border border-slate-600 font-medium">
                              Ledger
                            </span>
                          )}

                          {tx.payment?.status && (
                            <span className={`text-[10px] font-semibold ${tx.payment.status === 'SUCCESS' ? 'text-emerald-400' : tx.payment.status === 'PENDING' ? 'text-amber-400' : 'text-red-400'}`}>
                              &bull; {tx.payment.status}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                          <span className="truncate max-w-[150px]" title={reference}>{reference}</span>
                          <button
                            onClick={() => handleCopyReference(reference, tx.id)}
                            className="text-slate-500 hover:text-slate-300 p-0.5 transition"
                            title="Copy transaction reference"
                          >
                            {copiedRefId === tx.id ? (
                              <span className="text-[10px] text-emerald-400 font-sans font-bold">Copied!</span>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs rounded-full border font-medium ${
                          tx.type === 'PAYMENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          tx.type === 'RENT_DEDUCTION' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                          'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}>
                          {tx.type}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className={`font-semibold ${Number(tx.amountGHS) < 0 ? 'text-amber-400' : 'text-slate-100'}`}>
                          {Number(tx.amountGHS) < 0 ? '-' : ''}${Math.abs(Number(tx.amountGHS)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {tx.payment?.originalCurrency && tx.payment.originalCurrency !== 'USD' && (
                          <div className="text-xs text-slate-400">
                            ({tx.payment.originalCurrency} {Number(tx.payment.originalAmount).toLocaleString()})
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {tx.paymentId ? (
                          <button
                            onClick={() => handleDownloadReceipt(tx.paymentId)}
                            disabled={downloadingReceiptId === tx.paymentId}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition shadow-sm"
                            title="Download official PDF payment receipt"
                          >
                            {downloadingReceiptId === tx.paymentId ? (
                              <>
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Downloading...
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                PDF Receipt
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
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

  const filteredInvoices = allInvoices.filter(inv => {
    if (invoiceFilter === 'PAID') return inv.isPaid;
    if (invoiceFilter === 'UNPAID') return !inv.isPaid;
    if (invoiceFilter === 'OVERDUE') return inv.isOverdue;
    return true;
  });

  const totalPaidInvoicesAmount = allInvoices
    .filter(inv => inv.isPaid)
    .reduce((sum, inv) => sum + Number(inv.amountDue), 0);

  const totalPendingInvoicesAmount = allInvoices
    .filter(inv => !inv.isPaid)
    .reduce((sum, inv) => sum + Number(inv.amountDue), 0);

  const renderInvoices = () => (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-light text-slate-200">Invoices & Payment Links</h2>
          <p className="text-sm text-slate-400 mt-1">Generate Stripe checkout payment links for clients, email invoices, and track payments.</p>
        </div>
        <button 
          onClick={() => setShowInvoiceModal(true)}
          className="bg-brand-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-primary/90 transition shadow-lg shadow-brand-primary/20 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Generate Payment Link Invoice
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-700/50">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block mb-1">Total Invoices</span>
          <div className="text-2xl font-bold text-slate-100">{allInvoices.length}</div>
          <span className="text-xs text-slate-500 mt-1 block">All generated payment requests</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/10">
          <span className="text-xs text-emerald-400 font-medium uppercase tracking-wider block mb-1">Paid Invoices</span>
          <div className="text-2xl font-bold text-emerald-400">
            {allInvoices.filter(i => i.isPaid).length} <span className="text-sm font-normal text-slate-400">({formatCurrency(totalPaidInvoicesAmount, allInvoices[0]?.currency || 'USD')})</span>
          </div>
          <span className="text-xs text-emerald-500/70 mt-1 block">Successfully settled via Stripe / portal</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-amber-950/10">
          <span className="text-xs text-amber-400 font-medium uppercase tracking-wider block mb-1">Pending / Overdue</span>
          <div className="text-2xl font-bold text-amber-400">
            {allInvoices.filter(i => !i.isPaid).length} <span className="text-sm font-normal text-slate-400">({formatCurrency(totalPendingInvoicesAmount, allInvoices[0]?.currency || 'USD')})</span>
          </div>
          <span className="text-xs text-amber-500/70 mt-1 block">Awaiting client payment</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['ALL', 'UNPAID', 'OVERDUE', 'PAID'] as const).map(filter => (
          <button
            key={filter}
            onClick={() => setInvoiceFilter(filter)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition ${
              invoiceFilter === filter 
                ? 'bg-brand-primary text-white border-brand-primary shadow-sm shadow-brand-primary/30' 
                : 'bg-slate-800/40 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            {filter} {filter === 'ALL' ? `(${allInvoices.length})` : `(${allInvoices.filter(i => filter === 'PAID' ? i.isPaid : filter === 'OVERDUE' ? i.isOverdue : !i.isPaid).length})`}
          </button>
        ))}
      </div>

      {/* Invoices List Table */}
      <div className="glass-panel rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 uppercase text-xs border-b border-slate-700/50">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Client & Property</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Amount Due</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Due Date</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-right">Payment Link Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {isLoadingInvoices ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Loading invoices...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">No invoices found for this filter.</td></tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-100">{inv.clientName}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{inv.propertyAddress}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{inv.clientEmail}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-100">
                      <div>{inv.currency === 'USD' ? '$' : inv.currency === 'EUR' ? '€' : '₵'}{Number(inv.amountDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      {Number(inv.amountDue) > 999999.99 && (
                        <span className="text-[10px] text-amber-400 font-normal inline-flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          Exceeds Stripe $1M Cap
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-slate-300">{new Date(inv.dueDate).toLocaleDateString()}</div>
                      {inv.isOverdue && (
                        <span className="text-[11px] text-red-400 font-medium block">Past Due Date</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {inv.isPaid ? (
                        <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium inline-flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Paid
                        </span>
                      ) : inv.isOverdue ? (
                        <span className="px-2.5 py-1 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                          Overdue
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!inv.isPaid ? (
                        <div className="flex justify-end items-center gap-2">
                          {Number(inv.amountDue) > 999999.99 ? (
                            <button
                              onClick={() => {
                                setSplitTargetInvoice(inv);
                                setTrancheCount(Math.ceil(Number(inv.amountDue) / 900000));
                              }}
                              className="px-3 py-1.5 text-xs rounded-lg border bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 font-semibold transition flex items-center gap-1.5 shadow-lg shadow-amber-950/20"
                              title="Invoice exceeds $999k Stripe ceiling. Split into milestone tranches."
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                              Split Tranches
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSplitTargetInvoice(inv);
                                setTrancheCount(2);
                              }}
                              className="px-2.5 py-1.5 text-xs rounded-lg border bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 transition flex items-center gap-1"
                              title="Split this invoice into 2 or more milestone tranches"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                              Split
                            </button>
                          )}

                          <button
                            onClick={() => handleGenerateLinkForExisting(inv.id, false)}
                            disabled={generatingLinkId === inv.id}
                            className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition flex items-center gap-1.5 ${
                              copiedLinkId === inv.id
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                            }`}
                            title="Generate and copy Stripe payment link to clipboard"
                          >
                            {generatingLinkId === inv.id ? (
                              'Generating...'
                            ) : copiedLinkId === inv.id ? (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Link Copied!
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                Copy Link
                              </>
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleGenerateLinkForExisting(inv.id, true)}
                            disabled={generatingLinkId === inv.id}
                            className="px-3 py-1.5 text-xs rounded-lg border bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary border-brand-primary/30 font-medium transition flex items-center gap-1.5"
                            title="Send Stripe Payment Link directly to client's email"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            Email Client
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Settled</span>
                      )}
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
              { id: 'invoices', label: 'Invoices & Links' },
              { id: 'applications', label: 'Applications' },
              { id: 'transactions', label: 'Payments & Transactions' }
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
          {activeTab === 'invoices' && renderInvoices()}
          {activeTab === 'applications' && renderApplications()}
          {activeTab === 'transactions' && renderTransactions()}
        </div>

      </div>

      {/* Generated Link Result Modal */}
      {generatedLinkResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-brand-primary/40 shadow-2xl relative animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Stripe Payment Link Generated!</h3>
                <p className="text-xs text-slate-400">Invoice ready for {generatedLinkResult.clientName}</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-4">
              A secure Stripe Checkout payment link has been created for <strong className="text-white">{formatCurrency(generatedLinkResult.amount, generatedLinkResult.currency || 'USD')}</strong>. Clients can click this link to pay immediately via Card, Google Pay, or Apple Pay.
            </p>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-700/60 mb-6 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-300 truncate font-mono select-all flex-1">{generatedLinkResult.url}</span>
              <button
                onClick={() => handleCopyLink(generatedLinkResult.url, 'modal-result')}
                className="bg-brand-primary hover:bg-brand-primary/90 text-white text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition"
              >
                {copiedLinkId === 'modal-result' ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            <div className="flex gap-3 justify-end">
              <a
                href={generatedLinkResult.url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
              >
                Open Stripe Checkout
              </a>
              <button
                type="button"
                onClick={() => setGeneratedLinkResult(null)}
                className="px-5 py-2 text-xs bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition shadow-lg shadow-brand-primary/20"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-slate-700 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-medium text-slate-100 mb-2">Generate Payment Link Invoice</h3>
            <p className="text-xs text-slate-400 mb-6">Create a new invoice and automatically generate a secure Stripe payment link for the client.</p>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Select Client Payment Plan *</label>
                <select
                  required
                  className="w-full p-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary text-sm"
                  value={newInvoiceForm.paymentPlanId}
                  onChange={e => {
                    const planId = e.target.value;
                    const selected = balances.find(b => b.planId === planId);
                    setNewInvoiceForm({
                      ...newInvoiceForm,
                      paymentPlanId: planId,
                      amount: selected ? String(Math.min(selected.balanceRemaining, 5000)) : newInvoiceForm.amount
                    });
                  }}
                >
                  <option value="">-- Choose an active payment plan --</option>
                  {balances.map(b => (
                    <option key={b.planId} value={b.planId}>
                      {b.clientName} &bull; {b.propertyAddress} (Remaining: {formatCurrency(b.balanceRemaining, b.currency || 'USD')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Amount to Invoice ({balances.find(b => b.planId === newInvoiceForm.paymentPlanId)?.currency || 'USD'}) *
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full p-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary text-sm"
                    value={newInvoiceForm.amount}
                    onChange={e => setNewInvoiceForm({ ...newInvoiceForm, amount: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Due Date *</label>
                  <input
                    required
                    type="date"
                    className="w-full p-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary text-sm"
                    value={newInvoiceForm.dueDate}
                    onChange={e => setNewInvoiceForm({ ...newInvoiceForm, dueDate: e.target.value })}
                  />
                </div>
              </div>

              {Number(newInvoiceForm.amount) > 999999.99 && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex items-start gap-3">
                  <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <span className="font-semibold block text-amber-300 text-sm mb-0.5">Stripe Single Transaction Limit ($999,999.99)</span>
                    <p className="text-slate-300">
                      Stripe limits single online credit card transactions to $999,999.99. You can enter smaller milestone installment amounts (e.g. {formatCurrency(Number(newInvoiceForm.amount) / 2, balances.find(b => b.planId === newInvoiceForm.paymentPlanId)?.currency || 'USD')} each) or record as a Bank Wire Payment.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Invoice Memo / Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly Rent-to-Own Installment or Milestone Deposit"
                  className="w-full p-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary text-sm"
                  value={newInvoiceForm.description}
                  onChange={e => setNewInvoiceForm({ ...newInvoiceForm, description: e.target.value })}
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={newInvoiceForm.sendEmail}
                    onChange={e => setNewInvoiceForm({ ...newInvoiceForm, sendEmail: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-primary bg-slate-900 border-slate-700 focus:ring-brand-primary"
                  />
                  <span>Email the Stripe payment link directly to the client</span>
                </label>
              </div>

              <div className="flex gap-3 justify-end mt-8 pt-4 border-t border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition shadow-lg shadow-brand-primary/20 font-medium"
                >
                  Generate Stripe Payment Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Manual Bank Wire Modal */}
      {showManualWireModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-slate-700 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-medium text-slate-100">Record Bank Wire Payment</h3>
              <button 
                onClick={() => setShowManualWireModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-6">Manually record a direct bank transfer or wire received offline from a client.</p>

            <form onSubmit={handleRecordManualPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Select Client Payment Plan *</label>
                <select
                  required
                  className="w-full p-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary text-sm"
                  value={manualWireForm.paymentPlanId}
                  onChange={e => {
                    const planId = e.target.value;
                    const selected = balances.find(b => b.planId === planId);
                    setManualWireForm({
                      ...manualWireForm,
                      paymentPlanId: planId,
                      amount: selected ? String(Math.min(selected.balanceRemaining, 5000)) : manualWireForm.amount
                    });
                  }}
                >
                  <option value="">-- Choose an active payment plan --</option>
                  {balances.map(b => (
                    <option key={b.planId} value={b.planId}>
                      {b.clientName} &bull; {b.propertyAddress} (Remaining: {formatCurrency(b.balanceRemaining, b.currency || 'USD')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Amount Paid ({balances.find(b => b.planId === manualWireForm.paymentPlanId)?.currency || 'USD'}) *
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full p-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary text-sm"
                    value={manualWireForm.amount}
                    onChange={e => setManualWireForm({ ...manualWireForm, amount: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Payment Date *</label>
                  <input
                    required
                    type="date"
                    className="w-full p-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary text-sm"
                    value={manualWireForm.date}
                    onChange={e => setManualWireForm({ ...manualWireForm, date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Bank Wire Reference / Swift Code</label>
                <input
                  type="text"
                  placeholder="e.g. GCBB-WIRE-992019 or Slip #"
                  className="w-full p-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary text-sm font-mono"
                  value={manualWireForm.reference}
                  onChange={e => setManualWireForm({ ...manualWireForm, reference: e.target.value })}
                />
              </div>

              <div className="flex gap-3 justify-end mt-8 pt-4 border-t border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setShowManualWireModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition shadow-lg shadow-brand-primary/20 font-medium"
                >
                  Record Payment & Update Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Split Invoice Modal */}
      {splitTargetInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-slate-700 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-medium text-slate-100">Split Invoice into Milestone Tranches</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Divide this invoice into multiple milestone installments so that each payment stays under the Stripe $999,999.99 limit.
                </p>
              </div>
              <button 
                onClick={() => setSplitTargetInvoice(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700/60 mb-5">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-400">Client:</span>
                <span className="text-slate-200 font-medium">{splitTargetInvoice.clientName}</span>
              </div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-400">Property:</span>
                <span className="text-slate-300 text-xs truncate max-w-[250px]">{splitTargetInvoice.propertyAddress}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-800">
                <span className="text-slate-400">Total Invoice Amount:</span>
                <span className="text-brand-secondary font-bold text-base">
                  {formatCurrency(splitTargetInvoice.amountDue, splitTargetInvoice.currency)}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Select Number of Tranches:</label>
              <div className="grid grid-cols-3 gap-3">
                {[2, 3, 4].map(num => {
                  const trancheAmount = Number(splitTargetInvoice.amountDue) / num;
                  const isCompliant = trancheAmount <= 999999.99;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setTrancheCount(num)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        trancheCount === num 
                          ? 'bg-brand-primary/20 border-brand-primary text-white shadow-lg shadow-brand-primary/10' 
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="font-semibold text-sm">{num} Tranches</div>
                      <div className={`text-xs mt-1 font-mono font-medium ${isCompliant ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {formatCurrency(trancheAmount, splitTargetInvoice.currency)}
                      </div>
                      {isCompliant ? (
                        <span className="text-[10px] text-emerald-400/80 block mt-0.5">Stripe OK</span>
                      ) : (
                        <span className="text-[10px] text-amber-400/80 block mt-0.5">Still {'>'}$1M</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Each tranche will be generated as a separate invoice due 30 days apart, each with its own Stripe checkout link.
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-700/50">
              <button
                type="button"
                onClick={() => setSplitTargetInvoice(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSplitInvoice}
                disabled={isSplitting}
                className="px-5 py-2 text-sm bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition shadow-lg shadow-brand-primary/20 font-medium flex items-center gap-2"
              >
                {isSplitting ? 'Splitting Invoices...' : `Confirm & Create ${trancheCount} Tranches`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
