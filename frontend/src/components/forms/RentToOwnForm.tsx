import React, { useState } from 'react';

type RentToOwnFormProps = {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting: boolean;
};

const SECTIONS = [
  'Personal Information',
  'Employment Details',
  'Housing Details',
  'Financial Details',
  'Next of Kin',
  'Documents',
  'Declarations'
];

const RentToOwnForm: React.FC<RentToOwnFormProps> = ({ onSubmit, onCancel, isSubmitting }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<any>({
    applicationType: 'Rent-to-Own'
  });

  const handleNext = () => {
    if (currentStep < SECTIONS.length - 1) {
      setCurrentStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev: any) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    if (files && files.length > 0) {
      setFormData((prev: any) => ({ ...prev, [name]: files[0].name })); // Storing just name for MVP
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep === SECTIONS.length - 1) {
      onSubmit(formData);
    } else {
      handleNext();
    }
  };

  return (
    <div className="w-full text-slate-200">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-slate-100">{SECTIONS[currentStep]}</h2>
          <span className="text-brand-primary font-medium text-sm">Step {currentStep + 1} of {SECTIONS.length}</span>
        </div>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-brand-primary h-full transition-all duration-300" 
            style={{ width: `${((currentStep + 1) / SECTIONS.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {currentStep === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-slate-300">Full Name (as on official records)</label>
              <input required type="text" name="fullName" value={formData.fullName || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Gender</label>
              <select required name="gender" value={formData.gender || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none">
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Date of Birth</label>
              <input required type="date" name="dob" value={formData.dob || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Marital Status</label>
              <select required name="maritalStatus" value={formData.maritalStatus || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none">
                <option value="">Select...</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Number of Dependents</label>
              <input required type="number" name="dependents" value={formData.dependents || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">National ID / Passport Number</label>
              <input required type="text" name="nationalId" value={formData.nationalId || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Tax Identification Number (TIN)</label>
              <input required type="text" name="tin" value={formData.tin || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-slate-300">Residential Address</label>
              <textarea required name="residentialAddress" value={formData.residentialAddress || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" rows={2}></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Email Address</label>
              <input required type="email" name="email" value={formData.email || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Mobile Phone Number</label>
              <input required type="tel" name="mobilePhone" value={formData.mobilePhone || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Alternative Phone Number</label>
              <input type="tel" name="altPhone" value={formData.altPhone || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-slate-300">Employer Name (Government Institution)</label>
              <input required type="text" name="employerName" value={formData.employerName || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-slate-300">Ministry / Department / Agency</label>
              <input required type="text" name="ministry" value={formData.ministry || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Position / Job Title</label>
              <input required type="text" name="jobTitle" value={formData.jobTitle || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Employee Number / Staff ID</label>
              <input required type="text" name="employeeId" value={formData.employeeId || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Date of First Appointment</label>
              <input required type="date" name="dateFirstAppointment" value={formData.dateFirstAppointment || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Type of Employment</label>
              <select required name="employmentType" value={formData.employmentType || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none">
                <option value="">Select...</option>
                <option value="Permanent">Permanent</option>
                <option value="Contract">Contract</option>
                <option value="Temporary">Temporary</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Monthly Gross Salary (GHS)</label>
              <input required type="number" name="grossSalary" value={formData.grossSalary || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Monthly Net Salary (after deductions)</label>
              <input required type="number" name="netSalary" value={formData.netSalary || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Name of HR / Payroll Officer</label>
              <input required type="text" name="hrName" value={formData.hrName || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">HR / Payroll Officer Contact</label>
              <input required type="tel" name="hrContact" value={formData.hrContact || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Preferred Housing Type</label>
              <select required name="preferredHousing" value={formData.preferredHousing || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none">
                <option value="">Select...</option>
                <option value="1-Bedroom Unit">1-Bedroom Unit</option>
                <option value="2-Bedroom Unit">2-Bedroom Unit</option>
                <option value="3-Bedroom Unit">3-Bedroom Unit</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Preferred Location / Estate</label>
              <input required type="text" name="preferredLocation" value={formData.preferredLocation || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Intended Occupancy</label>
              <select required name="intendedOccupancy" value={formData.intendedOccupancy || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none">
                <option value="">Select...</option>
                <option value="Self">Self</option>
                <option value="Family">Family</option>
                <option value="Dependent">Dependent</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Are you currently renting a property?</label>
              <select required name="isRenting" value={formData.isRenting || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none">
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            {formData.isRenting === 'Yes' && (
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-300">If Yes, Monthly Rent (GHS)</label>
                <input required type="number" name="monthlyRent" value={formData.monthlyRent || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Do you currently own any other property?</label>
              <select required name="ownsProperty" value={formData.ownsProperty || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none">
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            {formData.ownsProperty === 'Yes' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-slate-300">If Yes, please provide details</label>
                <textarea required name="ownPropertyDetails" value={formData.ownPropertyDetails || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" rows={2}></textarea>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Proposed Initial Deposit (GHS)</label>
              <input required type="number" name="proposedInitialDeposit" value={formData.proposedInitialDeposit || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Preferred Tenure of Repayment</label>
              <select required name="preferredTenure" value={formData.preferredTenure || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none">
                <option value="">Select...</option>
                <option value="5 Years">5 Years</option>
                <option value="10 Years">10 Years</option>
                <option value="15 Years">15 Years</option>
                <option value="20 Years">20 Years</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Preferred Monthly Repayment (GHS)</label>
              <input required type="number" name="preferredMonthlyRepayment" value={formData.preferredMonthlyRepayment || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Mode of Repayment</label>
              <select required name="modeOfRepayment" value={formData.modeOfRepayment || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none">
                <option value="">Select...</option>
                <option value="Payroll Deduction">Payroll Deduction</option>
                <option value="Standing Order">Standing Order</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="md:col-span-2 mt-2 text-brand-primary font-medium border-b border-slate-700 pb-2">Bank Details</div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Bank Name</label>
              <input required type="text" name="bankName" value={formData.bankName || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Account Name</label>
              <input required type="text" name="accountName" value={formData.accountName || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Account Number</label>
              <input required type="text" name="accountNumber" value={formData.accountNumber || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Existing loan obligations?</label>
              <select required name="hasExistingLoan" value={formData.hasExistingLoan || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none">
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            {formData.hasExistingLoan === 'Yes' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-slate-300">If Yes, please state</label>
                <textarea required name="existingLoanDetails" value={formData.existingLoanDetails || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" rows={2}></textarea>
              </div>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-slate-300">Full Name (Next of Kin)</label>
              <input required type="text" name="nokName" value={formData.nokName || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Relationship to Applicant</label>
              <input required type="text" name="nokRelationship" value={formData.nokRelationship || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Date of Birth</label>
              <input required type="date" name="nokDob" value={formData.nokDob || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Phone Number</label>
              <input required type="tel" name="nokPhone" value={formData.nokPhone || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Email (if available)</label>
              <input type="email" name="nokEmail" value={formData.nokEmail || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-slate-300">Address</label>
              <textarea required name="nokAddress" value={formData.nokAddress || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" rows={2}></textarea>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4 animate-fade-in text-sm">
            <p className="text-slate-400 mb-6 bg-brand-primary/10 p-3 rounded-lg border border-brand-primary/30">Please attach clear copies of the documents (mandatory unless stated otherwise). <br/> <span className="font-semibold text-brand-primary">Note: Document upload logic will be integrated with backend storage later. Selected files are attached to the form payload.</span></p>
            {[
              { label: 'Passport-sized photograph (2 copies)', name: 'docPassportPhoto' },
              { label: 'National ID / Passport', name: 'docNationalId' },
              { label: 'Employment Letter / Confirmation of Appointment', name: 'docEmploymentLetter' },
              { label: 'Last 3 months payslips', name: 'docPayslips' },
              { label: 'Bank statement (last 6 months)', name: 'docBankStatement' },
              { label: 'Utility bill (proof of residence)', name: 'docUtilityBill' },
              { label: 'Tax clearance certificate (if applicable)', name: 'docTaxClearance', required: false },
              { label: 'Next of Kin ID card', name: 'docNokId' }
            ].map(doc => (
              <div key={doc.name} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <span className="text-slate-300 font-medium">{doc.label}</span>
                <input 
                  type="file" 
                  required={doc.required !== false}
                  name={doc.name} 
                  onChange={handleFileChange}
                  className="text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30"
                />
              </div>
            ))}
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 text-slate-300 text-sm leading-relaxed mb-6">
              <h3 className="text-lg font-semibold text-slate-100 mb-2">Declaration</h3>
              <p>I hereby declare that the information provided in this application is true and correct to the best of my knowledge. I authorize CERENO HOMES LIMITED to verify information provided.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-slate-300">Name (Printed)</label>
                <input required type="text" name="declarantName" value={formData.declarantName || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-300">Signature (type full name to sign)</label>
                <input required type="text" name="declarantSignature" value={formData.declarantSignature || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none font-serif italic" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-300">Date</label>
                <input required type="date" name="declarantDate" value={formData.declarantDate || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
              </div>
            </div>

            <div className="mt-8 border-t border-slate-700 pt-6">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Employer's Confirmation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-300">Employer Rep Name</label>
                  <input required type="text" name="employerRepName" value={formData.employerRepName || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-300">Designation</label>
                  <input required type="text" name="employerDesignation" value={formData.employerDesignation || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-300">Signature (type full name)</label>
                  <input required type="text" name="employerSignature" value={formData.employerSignature || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none font-serif italic" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-300">Date</label>
                  <input required type="date" name="employerDate" value={formData.employerDate || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-slate-300">Official Stamp / Seal (Upload)</label>
                  <input required type="file" name="employerStamp" onChange={handleFileChange} className="text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-slate-300">Comments</label>
                  <textarea name="employerComments" value={formData.employerComments || ''} onChange={handleChange} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-brand-primary outline-none" rows={2}></textarea>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex items-center">
              <input required type="checkbox" id="termsAgreed" name="termsAgreed" checked={formData.termsAgreed || false} onChange={handleChange} className="w-5 h-5 rounded border-slate-700 text-brand-primary focus:ring-brand-primary bg-slate-800" />
              <label htmlFor="termsAgreed" className="ml-3 text-sm text-slate-300">
                I agree to the <a href="https://cerenohomes.cbsgroupofcompanies.com/terms-and-conditions/" target="_blank" rel="noreferrer" className="text-brand-primary hover:underline">Terms and Conditions</a>
              </label>
            </div>
          </div>
        )}

        <div className="flex gap-4 pt-6 border-t border-slate-700/50 mt-8">
          <button 
            type="button" 
            onClick={currentStep === 0 ? onCancel : handlePrev}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl transition-colors font-medium"
          >
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </button>
          
          <button 
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-brand-primary hover:bg-brand-primary/90 text-white py-3 rounded-xl transition-colors font-medium shadow-lg shadow-brand-primary/20 disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : (currentStep === SECTIONS.length - 1 ? 'Submit Application' : 'Continue')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RentToOwnForm;
