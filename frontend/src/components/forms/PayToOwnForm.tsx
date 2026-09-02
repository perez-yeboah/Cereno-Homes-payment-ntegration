import React, { useState } from 'react';

type PayToOwnFormProps = {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting: boolean;
};

const PayToOwnForm: React.FC<PayToOwnFormProps> = ({ onSubmit, onCancel, isSubmitting }) => {
  const [formData, setFormData] = useState({
    applicationType: 'Pay-to-Own',
    name: '',
    email: '',
    phoneNumber: '',
    message: '',
    termsAgreed: false
  });

  const [showTerms, setShowTerms] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="w-full text-slate-200">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-100">Pay To Own Application</h2>
        <p className="text-sm text-slate-400 mt-1">Please fill in your details to apply for Pay-to-Own.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Name</label>
            <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-accent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Email</label>
            <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-accent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Phone Number</label>
            <input required type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-accent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Message</label>
            <textarea required name="message" value={formData.message} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-accent outline-none" rows={4}></textarea>
          </div>
        </div>

        <div className="mt-6 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
          <div className="flex items-center">
            <input required type="checkbox" id="termsAgreed" name="termsAgreed" checked={formData.termsAgreed} onChange={handleChange} className="w-5 h-5 rounded border-slate-700 text-brand-accent focus:ring-brand-accent bg-slate-800" />
            <label htmlFor="termsAgreed" className="ml-3 text-sm text-slate-300">
              I agree to the <button type="button" onClick={() => setShowTerms(true)} className="text-brand-accent hover:underline focus:outline-none">Terms and Conditions</button>
            </label>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button 
            type="button" 
            onClick={onCancel}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          
          <button 
            type="submit"
            disabled={isSubmitting || !formData.termsAgreed}
            className="flex-1 bg-brand-accent hover:bg-brand-accent/90 text-white py-3 rounded-xl transition-colors font-medium shadow-lg shadow-brand-accent/20 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Apply Now'}
          </button>
        </div>
      </form>

      {/* Terms and Conditions Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60] overflow-y-auto">
          <div className="bg-brand-surface border border-slate-700/50 p-8 rounded-3xl w-full max-w-3xl shadow-2xl my-8">
            <h2 className="text-2xl font-semibold mb-4 text-slate-100">Pay To Own Terms & Conditions</h2>
            
            <div className="text-sm text-slate-300 space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <h3 className="font-semibold text-slate-200">DEFINING TERMS:</h3>
              
              <div>
                <h4 className="font-medium text-slate-200">Cash on Delivery Customers</h4>
                <p>All Subscribers/Customers who are able, ready and willing to pay up the EPCC on the defined terms and within the defined time period.</p>
              </div>

              <div>
                <h4 className="font-medium text-slate-200">Proof of Land Title (PoFT)</h4>
                <p>A Subscriber/Customer shall be required to demonstrate a Proof of Land Title, by presenting land title document(s). The Contractor/Developer shall have the responsibility to independently verify and confirm that the Subscriber/Developer indeed has title to the parcel of land under construction, using all legally appropriate procedures. A favourable/affirmative report is the necessary first step for the initiation of the transaction between the Subscriber/Customer and the contractor/developer.</p>
              </div>

              <div>
                <h4 className="font-medium text-slate-200">Proof of Funds (PoF)</h4>
                <p>Before a Subscriber/Customer is signed up to the Affordable Housing Scheme, there must be a demonstrable Proof of Funds (PoF) covering at least 60% of the EPCC in a form that is acceptable to the Contractor/Developer.</p>
              </div>

              <div>
                <h4 className="font-medium text-slate-200">Estimated Project Cost to Completion (EPCC)</h4>
                <p>All cost associated with the project from clearing of site to delivery of the core and roofing.</p>
              </div>

              <div>
                <h4 className="font-medium text-slate-200">Estimated Project Completion Time (EPCT)</h4>
                <p>Estimated Project Completion Time (EPCT) is the standard Eight (8) Weeks from the date 20% commitment fee is paid.</p>
              </div>

              <div>
                <h4 className="font-medium text-slate-200">Contractor/Developer</h4>
                <p>Cereno Homes Limited is Contractor/Developer for all intents and purposes, including legal and technical.</p>
              </div>

              <div>
                <h4 className="font-medium text-slate-200">Subscriber/Customer</h4>
                <p>Any interested individual or organization that is willing, able and ready to make the initial commitment payment of 20%.</p>
              </div>

              <h3 className="font-semibold text-slate-200 mt-6 pt-4 border-t border-slate-700/50">Payment Terms</h3>
              <ul className="list-decimal pl-5 space-y-3">
                <li>
                  Subscriber/Customer shall be required to deposit 20% of the Estimated Project Cost to Completion (EPCC). This 20% of the EPCC shall be a non-refundable commitment fee and shall cover the following project milestones:
                  <ul className="list-disc pl-5 mt-2 text-slate-400">
                    <li>Clearing and preparation of site for construction to commence, and raising of platforms for main construction to commence.</li>
                  </ul>
                </li>
                <li>
                  The next 30% of the EPCC shall be payable after a successful review by of the prior milestones. This shall cover the following milestones:
                  <ul className="list-disc pl-5 mt-2 text-slate-400">
                    <li>Moving construction materials and labour and machinery to site, and</li>
                    <li>Physical construction of the approved design shall commence and completed within the Estimated Project Completion Time (EPCT). This shall include all such activities up the completion of the concrete core and roofing, but without finishing and furnishing.</li>
                  </ul>
                </li>
                <li>
                  After the completion and delivery of all prior milestones as described supra, the client shall be expected without fail to make the final payment of 30% of the EPCC to the Contractor/Developer.
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-700/50 text-right">
              <button 
                onClick={() => setShowTerms(false)}
                className="bg-brand-accent hover:bg-brand-accent/90 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayToOwnForm;
