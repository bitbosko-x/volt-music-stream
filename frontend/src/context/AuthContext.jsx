import { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribe;
        try {
            unsubscribe = onAuthStateChanged(auth, (user) => {
                setCurrentUser(user);
                setLoading(false);
            }, (error) => {
                console.error("Auth state change error:", error);
                setLoading(false); // Make sure we don't get stuck loading
            });
        } catch (error) {
            console.error("Firebase auth initialization failed:", error);
            setLoading(false); // Fail gracefully to guest mode
        }
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const loginWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout Error:", error);
            throw error;
        }
    };

    const value = {
        currentUser,
        loginWithGoogle,
        logout,
        isGuest: !currentUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {/* If there's an issue with Firebase, loading might never become false. Fallback after a timeout could be added, but for now we'll just render if !loading */}
            {!loading ? children : <div className="h-screen w-screen flex items-center justify-center bg-black text-white">Loading...</div>}
        </AuthContext.Provider>
    );
}
