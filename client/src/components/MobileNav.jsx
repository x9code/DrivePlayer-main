import React from 'react';
import { IoHome, IoHomeOutline, IoSearch, IoSearchOutline, IoLibrary, IoLibraryOutline, IoHeart, IoHeartOutline, IoPerson, IoPersonOutline } from 'react-icons/io5';

const MobileNav = ({ activeTab, onNavigate }) => {
    
    const navItems = [
        { id: 'root', label: 'Home', icon: IoHomeOutline, activeIcon: IoHome },
        { id: 'search', label: 'Search', icon: IoSearchOutline, activeIcon: IoSearch },
        { id: 'favorites', label: 'Liked', icon: IoHeartOutline, activeIcon: IoHeart },
        { id: 'profile', label: 'Profile', icon: IoPersonOutline, activeIcon: IoPerson },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-[68px] z-50 bg-[#0c0c0c] border-t border-white/5 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-around h-full px-2">
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = isActive ? item.activeIcon : item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${isActive ? 'text-primary' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <Icon size={24} className={isActive ? 'animate-in zoom-in duration-300' : ''} />
                            <span className="text-[10px] font-medium tracking-wide">
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default MobileNav;
