import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ReportModal({ isOpen, onClose, trackData }) {
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const user = auth.currentUser;
        const userKey = user ? user.uid : 'anonymous';
        const maxAllowed = user ? 5 : 1;
        const storageKey = 'volt_report_counts';
        
        try {
            const counts = JSON.parse(localStorage.getItem(storageKey) || '{}');
            const currentCount = counts[userKey] || 0;
            
            if (currentCount >= maxAllowed) {
                setError(`You have reached the maximum limit of ${maxAllowed} report${maxAllowed !== 1 ? 's' : ''}.`);
                return;
            }

            setIsSubmitting(true);
            setError('');

            // Increment the local counter immediately to prevent double-clicks
            counts[userKey] = currentCount + 1;
            localStorage.setItem(storageKey, JSON.stringify(counts));
            
            // Fire-and-forget Firebase call to prevent infinite hanging when connections drop (e.g. after logout)
            addDoc(collection(db, 'reports'), {
                type: 'audio_mismatch',
                userId: user ? user.uid : 'anonymous',
                userEmail: (user && user.email) ? user.email : 'guest',
                trackId: trackData?.id || trackData?.search_term || null,
                trackTitle: trackData?.title || '',
                trackArtist: trackData?.artist || '',
                streamUrl: trackData?.stream_url || '',
                source: trackData?.source || '',
                userMessage: message || '',
                status: 'pending',
                timestamp: serverTimestamp()
            }).catch(err => {
                console.error("Background report error:", err);
            });

            // Simulate a short network request to give the user satisfying feedback, then close
            setTimeout(() => {
                setSuccess(true);
                setTimeout(() => {
                    onClose();
                    setSuccess(false);
                    setMessage('');
                    setIsSubmitting(false);
                }, 2000);
            }, 600);

        } catch (err) {
            console.error("Error formatting report:", err);
            setError("Failed to create report. Please try again.");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-2 text-red-500">
                        <AlertTriangle className="h-5 w-5" />
                        <h2 className="text-lg font-semibold text-white">Report Mismatch</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white rounded-full">
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                
                <div className="p-6">
                    {success ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-medium text-white mb-2">Report Submitted</h3>
                            <p className="text-zinc-400">Thanks for helping us improve!</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="bg-white/5 p-4 rounded-xl mb-4">
                                <p className="text-sm font-medium text-white mb-1 truncate">{trackData?.title}</p>
                                <p className="text-xs text-zinc-400 truncate">{trackData?.artist}</p>
                            </div>
                            
                            <p className="text-sm text-zinc-300">
                                Does the current audio not match the song title and artist? Let us know.
                            </p>
                            
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Additional details (optional)..."
                                className="w-full h-24 bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                            />
                            
                            {error && <p className="text-red-500 text-sm">{error}</p>}
                            
                            <div className="flex gap-3 justify-end pt-2">
                                <Button type="button" variant="ghost" onClick={onClose} className="text-zinc-300 hover:text-white">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/50">
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        'Submit Report'
                                    )}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
