'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('patient');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
    :root{--navy:#0B1F3A;--navy-mid:#12305A;--navy-soft:#1E4380;--mint:#3CBEA0;--mint-light:#A8E6D9;--mint-pale:#E6F8F4;--blue:#2E7DD1;--blue-light:#E8F2FB;--white:#FFFFFF;--offwhite:#F7F9FC;--slate:#64748B;--slate-light:#E2E8F0;--text-dark:#0B1F3A;--text-body:#374151;--text-muted:#6B7280;--radius-sm:8px;--radius-md:14px;--radius-lg:20px;--radius-xl:28px;--shadow-card:0 4px 24px rgba(11,31,58,0.08);--shadow-float:0 8px 40px rgba(11,31,58,0.14);--font-display:'Playfair Display',serif;--font-body:'DM Sans',sans-serif;--font-mono:'DM Mono',monospace;}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html{scroll-behavior:smooth;}
    body{font-family:var(--font-body);color:var(--text-body);background:var(--white);line-height:1.6;overflow-x:hidden;}
    nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:18px 5%;display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.92);backdrop-filter:blur(16px);border-bottom:1px solid rgba(11,31,58,0.07);transition:box-shadow 0.3s;}
    nav.scrolled{box-shadow:0 2px 20px rgba(11,31,58,0.10);}
    .nav-logo{display:flex;align-items:center;gap:10px;font-family:var(--font-display);font-size:1.4rem;font-weight:600;color:var(--navy);text-decoration:none;}
    .logo-icon{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--mint) 0%,var(--blue) 100%);display:flex;align-items:center;justify-content:center;}
    .nav-links{display:flex;align-items:center;gap:32px;list-style:none;}
    .nav-links a{font-size:0.9rem;font-weight:500;color:var(--text-body);text-decoration:none;transition:color 0.2s;}
    .nav-links a:hover{color:var(--navy);}
    .nav-actions{display:flex;gap:12px;align-items:center;}
    .btn-ghost{padding:9px 20px;border-radius:50px;border:1.5px solid var(--slate-light);background:transparent;color:var(--navy);font-family:var(--font-body);font-size:0.875rem;font-weight:500;cursor:pointer;transition:all 0.2s;}
    .btn-ghost:hover{border-color:var(--navy);background:var(--offwhite);}
    .btn-primary{padding:10px 22px;border-radius:50px;border:none;background:var(--navy);color:white;font-family:var(--font-body);font-size:0.875rem;font-weight:500;cursor:pointer;transition:all 0.2s;}
    .btn-primary:hover{background:var(--navy-mid);transform:translateY(-1px);box-shadow:0 6px 20px rgba(11,31,58,0.25);}
    .btn-hero{display:inline-flex;align-items:center;gap:10px;padding:16px 32px;border-radius:50px;border:none;background:linear-gradient(135deg,var(--mint) 0%,#29A882 100%);color:white;font-family:var(--font-body);font-size:1rem;font-weight:600;cursor:pointer;transition:all 0.25s;box-shadow:0 8px 32px rgba(60,190,160,0.35);text-decoration:none;}
    .btn-hero:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(60,190,160,0.45);}
    .btn-hero-outline{display:inline-flex;align-items:center;gap:10px;padding:16px 32px;border-radius:50px;border:1.5px solid rgba(255,255,255,0.5);background:rgba(255,255,255,0.12);color:white;font-family:var(--font-body);font-size:1rem;font-weight:500;cursor:pointer;transition:all 0.25s;backdrop-filter:blur(8px);text-decoration:none;}
    .btn-hero-outline:hover{background:rgba(255,255,255,0.2);border-color:white;}
    .hero{min-height:100vh;background:linear-gradient(155deg,var(--navy) 0%,var(--navy-mid) 45%,#1A4A7A 100%);position:relative;overflow:hidden;display:flex;align-items:center;padding:120px 5% 80px;}
    .hero-bg-pattern{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle at 20% 50%,rgba(60,190,160,0.12) 0%,transparent 50%),radial-gradient(circle at 80% 20%,rgba(46,125,209,0.15) 0%,transparent 40%),radial-gradient(circle at 60% 80%,rgba(60,190,160,0.08) 0%,transparent 40%);}
    .hero-grid{position:absolute;inset:0;pointer-events:none;opacity:0.04;background-image:linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px);background-size:48px 48px;}
    .hero-content{position:relative;z-index:2;max-width:1200px;margin:0 auto;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;}
    .hero-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:50px;border:1px solid rgba(60,190,160,0.4);background:rgba(60,190,160,0.12);color:var(--mint-light);font-size:0.8rem;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:24px;}
    .hero-badge-dot{width:6px;height:6px;border-radius:50%;background:var(--mint);animation:pulse 2s infinite;}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(1.3)}}
    .hero-heading{font-family:var(--font-display);font-size:clamp(2.4rem,4.5vw,3.6rem);font-weight:600;color:white;line-height:1.18;margin-bottom:20px;letter-spacing:-0.01em;}
    .hero-heading .accent{color:var(--mint);}
    .hero-sub{font-size:1.1rem;color:rgba(255,255,255,0.72);line-height:1.7;max-width:520px;margin-bottom:36px;font-weight:300;}
    .hero-cta{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:48px;}
    .hero-trust{display:flex;gap:24px;flex-wrap:wrap;}
    .trust-item{display:flex;align-items:center;gap:8px;color:rgba(255,255,255,0.55);font-size:0.82rem;}
    .trust-check{width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(60,190,160,0.6);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .hero-visual{position:relative;}
    .hero-phone-mockup{background:white;border-radius:var(--radius-xl);padding:24px;box-shadow:0 30px 80px rgba(0,0,0,0.35);position:relative;max-width:360px;margin:0 auto;border:1px solid rgba(255,255,255,0.15);animation:float 4s ease-in-out infinite;}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
    .mockup-header{display:flex;align-items:center;gap:10px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--slate-light);}
    .mockup-avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--mint) 0%,var(--blue) 100%);display:flex;align-items:center;justify-content:center;color:white;font-weight:600;font-size:0.85rem;}
    .mockup-name{font-weight:600;font-size:0.9rem;color:var(--navy);}
    .mockup-sub{font-size:0.75rem;color:var(--text-muted);}
    .status-pill{margin-left:auto;padding:4px 12px;border-radius:50px;font-size:0.72rem;font-weight:600;letter-spacing:0.03em;}
    .status-approved{background:#E6F8F2;color:#0F7A5A;}
    .mockup-card{background:var(--offwhite);border-radius:var(--radius-md);padding:14px;margin-bottom:12px;}
    .mockup-card-title{font-size:0.78rem;font-weight:600;color:var(--navy);margin-bottom:4px;}
    .mockup-card-text{font-size:0.73rem;color:var(--text-muted);line-height:1.5;}
    .mockup-progress{margin-top:8px;}
    .progress-label{display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-muted);margin-bottom:5px;}
    .progress-bar{height:5px;border-radius:3px;background:var(--slate-light);overflow:hidden;}
    .progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--mint) 0%,var(--blue) 100%);}
    .mockup-drugs{display:flex;gap:8px;margin-top:10px;}
    .drug-chip{padding:5px 10px;border-radius:6px;background:white;border:1px solid var(--slate-light);font-size:0.7rem;font-weight:500;color:var(--navy);}
    .float-card{position:absolute;background:white;border-radius:var(--radius-md);padding:12px 16px;box-shadow:var(--shadow-float);border:1px solid var(--slate-light);animation:float-alt 4.5s ease-in-out infinite;}
    @keyframes float-alt{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    .float-card-1{top:-30px;right:-20px;animation-delay:1s;}
    .float-card-2{bottom:60px;right:-30px;animation-delay:0.5s;}
    .float-card-label{font-size:0.68rem;color:var(--text-muted);font-weight:500;}
    .float-card-value{font-size:1.1rem;font-weight:700;color:var(--navy);}
    section{padding:90px 5%;}
    .container{max-width:1200px;margin:0 auto;}
    .section-label{display:inline-flex;align-items:center;gap:8px;font-size:0.75rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--mint);margin-bottom:14px;}
    .section-label-line{width:24px;height:2px;background:var(--mint);border-radius:1px;}
    .section-heading{font-family:var(--font-display);font-size:clamp(2rem,3.5vw,2.8rem);font-weight:600;color:var(--navy);line-height:1.22;margin-bottom:16px;letter-spacing:-0.01em;}
    .section-sub{font-size:1.05rem;color:var(--text-muted);max-width:580px;line-height:1.7;}
    .text-center{text-align:center;}
    .section-sub.center{margin:0 auto;}
    .how-section{background:var(--offwhite);}
    .steps-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:0;margin-top:60px;position:relative;}
    .steps-grid::before{content:'';position:absolute;top:32px;left:calc(10% + 32px);right:calc(10% + 32px);height:2px;background:linear-gradient(90deg,var(--mint) 0%,var(--blue) 100%);z-index:0;}
    .step-item{display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 12px;position:relative;z-index:1;}
    .step-circle{width:64px;height:64px;border-radius:50%;background:white;border:2px solid var(--mint);display:flex;align-items:center;justify-content:center;margin-bottom:20px;position:relative;box-shadow:0 4px 20px rgba(60,190,160,0.2);transition:transform 0.3s,box-shadow 0.3s;}
    .step-circle:hover{transform:scale(1.08);box-shadow:0 8px 30px rgba(60,190,160,0.35);}
    .step-num{position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:50%;background:var(--navy);color:white;font-size:0.65rem;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);}
    .step-title{font-size:0.88rem;font-weight:600;color:var(--navy);margin-bottom:6px;}
    .step-desc{font-size:0.78rem;color:var(--text-muted);line-height:1.55;}
    .features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:56px;}
    .feature-card{background:white;border-radius:var(--radius-lg);padding:32px;border:1px solid var(--slate-light);box-shadow:var(--shadow-card);transition:transform 0.3s,box-shadow 0.3s;position:relative;overflow:hidden;}
    .feature-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--mint) 0%,var(--blue) 100%);opacity:0;transition:opacity 0.3s;}
    .feature-card:hover{transform:translateY(-5px);box-shadow:var(--shadow-float);}
    .feature-card:hover::before{opacity:1;}
    .feature-icon{width:52px;height:52px;border-radius:var(--radius-sm);background:var(--mint-pale);display:flex;align-items:center;justify-content:center;margin-bottom:20px;}
    .feature-title{font-size:1rem;font-weight:600;color:var(--navy);margin-bottom:10px;}
    .feature-desc{font-size:0.875rem;color:var(--text-muted);line-height:1.65;}
    .trust-section{background:linear-gradient(155deg,var(--navy) 0%,var(--navy-mid) 100%);position:relative;overflow:hidden;}
    .trust-section::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle at 80% 50%,rgba(60,190,160,0.1) 0%,transparent 50%);}
    .trust-grid{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;position:relative;z-index:1;}
    .trust-heading{font-family:var(--font-display);font-size:clamp(1.8rem,3vw,2.4rem);font-weight:600;color:white;line-height:1.25;margin-bottom:20px;}
    .trust-body{font-size:1rem;color:rgba(255,255,255,0.65);line-height:1.7;margin-bottom:30px;}
    .trust-badges{display:flex;flex-wrap:wrap;gap:12px;}
    .trust-badge{display:flex;align-items:center;gap:10px;padding:12px 18px;border-radius:var(--radius-md);border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);backdrop-filter:blur(10px);}
    .trust-badge-icon{width:36px;height:36px;border-radius:8px;background:rgba(60,190,160,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .trust-badge-label{font-size:0.78rem;font-weight:600;color:white;}
    .trust-badge-sub{font-size:0.7rem;color:rgba(255,255,255,0.45);}
    .trust-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:8px;}
    .stat-box{text-align:center;padding:24px;background:rgba(255,255,255,0.06);border-radius:var(--radius-lg);border:1px solid rgba(255,255,255,0.1);}
    .stat-num{font-family:var(--font-display);font-size:2rem;font-weight:600;color:white;margin-bottom:4px;}
    .stat-label{font-size:0.78rem;color:rgba(255,255,255,0.5);}
    .users-section{background:white;}
    .user-tabs{display:flex;gap:8px;margin-top:40px;margin-bottom:32px;flex-wrap:wrap;}
    .user-tab{padding:10px 22px;border-radius:50px;border:1.5px solid var(--slate-light);background:white;color:var(--text-muted);font-family:var(--font-body);font-size:0.875rem;font-weight:500;cursor:pointer;transition:all 0.2s;}
    .user-tab.active{background:var(--navy);color:white;border-color:var(--navy);}
    .user-panel{display:none;grid-template-columns:1fr 1fr;gap:40px;align-items:start;}
    .user-panel.active{display:grid;}
    .user-panel-content h3{font-family:var(--font-display);font-size:1.5rem;font-weight:600;color:var(--navy);margin-bottom:12px;}
    .user-panel-content p{font-size:0.95rem;color:var(--text-muted);line-height:1.7;margin-bottom:24px;}
    .benefit-list{list-style:none;}
    .benefit-item{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;font-size:0.875rem;color:var(--text-body);}
    .benefit-check{width:20px;height:20px;border-radius:50%;background:var(--mint-pale);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
    .user-panel-visual{background:linear-gradient(145deg,var(--offwhite) 0%,white 100%);border-radius:var(--radius-xl);padding:32px;border:1px solid var(--slate-light);box-shadow:var(--shadow-card);}
    .user-flow-step{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--slate-light);}
    .user-flow-step:last-child{border-bottom:none;}
    .flow-dot-wrap{display:flex;flex-direction:column;align-items:center;}
    .flow-dot{width:10px;height:10px;border-radius:50%;background:var(--mint);margin-top:5px;flex-shrink:0;}
    .flow-line{flex:1;width:2px;background:var(--mint-pale);margin-top:4px;}
    .flow-text-title{font-size:0.85rem;font-weight:600;color:var(--navy);margin-bottom:2px;}
    .flow-text-desc{font-size:0.78rem;color:var(--text-muted);}
    .brand-section{background:var(--offwhite);}
    .names-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-top:40px;}
    .name-card{background:white;border-radius:var(--radius-md);padding:24px 16px;border:1px solid var(--slate-light);text-align:center;transition:transform 0.2s,box-shadow 0.2s;}
    .name-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-card);}
    .name-card.featured{border-color:var(--mint);background:var(--mint-pale);}
    .name-main{font-family:var(--font-display);font-size:1.2rem;font-weight:600;color:var(--navy);margin-bottom:4px;}
    .name-tag{font-size:0.7rem;color:var(--text-muted);}
    .featured-badge{display:inline-block;padding:2px 8px;background:var(--mint);color:white;border-radius:50px;font-size:0.62rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px;}
    .taglines-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:40px;}
    .tagline-card{padding:20px 24px;background:white;border-radius:var(--radius-md);border:1px solid var(--slate-light);font-family:var(--font-display);font-size:1.05rem;font-style:italic;color:var(--navy);line-height:1.4;position:relative;padding-left:36px;}
    .tagline-card::before{content:'"';position:absolute;left:14px;top:14px;font-size:2rem;color:var(--mint);line-height:1;font-family:var(--font-display);}
    .cta-final{background:linear-gradient(145deg,var(--navy) 0%,#0F2D4A 50%,#1A4A7A 100%);text-align:center;position:relative;overflow:hidden;}
    .cta-final::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle at 30% 50%,rgba(60,190,160,0.12) 0%,transparent 50%),radial-gradient(circle at 70% 50%,rgba(46,125,209,0.12) 0%,transparent 50%);}
    .cta-heading{font-family:var(--font-display);font-size:clamp(2rem,3.5vw,2.8rem);font-weight:600;color:white;margin-bottom:16px;position:relative;z-index:1;}
    .cta-sub{font-size:1.05rem;color:rgba(255,255,255,0.65);max-width:500px;margin:0 auto 36px;position:relative;z-index:1;line-height:1.7;}
    .cta-actions{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;position:relative;z-index:1;}
    footer{background:var(--navy);padding:60px 5% 30px;color:rgba(255,255,255,0.5);font-size:0.85rem;}
    .footer-grid{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:50px;}
    .footer-logo{font-family:var(--font-display);font-size:1.3rem;font-weight:600;color:white;margin-bottom:12px;}
    .footer-tagline{font-size:0.82rem;color:rgba(255,255,255,0.4);line-height:1.6;}
    .footer-col-title{font-size:0.78rem;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:16px;}
    .footer-link{display:block;color:rgba(255,255,255,0.5);text-decoration:none;margin-bottom:10px;font-size:0.85rem;transition:color 0.2s;}
    .footer-link:hover{color:white;}
    .footer-bottom{max-width:1200px;margin:0 auto;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;}
    .footer-disclaimer{font-size:0.75rem;color:rgba(255,255,255,0.28);max-width:600px;line-height:1.5;}
    .fade-up{opacity:0;transform:translateY(28px);transition:opacity 0.65s ease,transform 0.65s ease;}
    .fade-up.visible{opacity:1;transform:translateY(0);}
    .stagger-1{transition-delay:0.1s;}.stagger-2{transition-delay:0.2s;}.stagger-3{transition-delay:0.3s;}.stagger-4{transition-delay:0.4s;}.stagger-5{transition-delay:0.5s;}
    @media(max-width:1024px){.hero-content{grid-template-columns:1fr;}.hero-visual{display:none;}.steps-grid{grid-template-columns:1fr 1fr;}.steps-grid::before{display:none;}.features-grid{grid-template-columns:1fr 1fr;}.trust-grid{grid-template-columns:1fr;}.names-grid{grid-template-columns:repeat(3,1fr);}.footer-grid{grid-template-columns:1fr 1fr;}}
    @media(max-width:768px){.nav-links{display:none;}section{padding:70px 5%;}.features-grid{grid-template-columns:1fr;}.user-panel.active{grid-template-columns:1fr;}.trust-stats{grid-template-columns:1fr 1fr;}.names-grid{grid-template-columns:1fr 1fr;}.taglines-grid{grid-template-columns:1fr;}.footer-grid{grid-template-columns:1fr;}.steps-grid{grid-template-columns:1fr;}.hero-cta{flex-direction:column;align-items:flex-start;}}
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* NAV */}
      <nav id="navbar" className={scrolled ? 'scrolled' : ''}>
        <a className="nav-logo" href="/">
          <div className="logo-icon">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="white"><path d="M10 2a1 1 0 011 1v2h2a3 3 0 010 6h-2v2a1 1 0 11-2 0v-2H7a3 3 0 010-6h2V3a1 1 0 011-1zm0 5H7a1 1 0 100 2h3V7zm2 0v2h1a1 1 0 100-2h-1z"/></svg>
          </div>
          VeraMed
        </a>
        <ul className="nav-links">
          <li><a href="#how">How It Works</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#users">Who It&apos;s For</a></li>
          <li><a href="#trust">Trust &amp; Safety</a></li>
        </ul>
        <div className="nav-actions">
          <button className="btn-ghost" onClick={() => router.push('/login')}>Sign In</button>
          <button className="btn-primary" onClick={() => router.push('/register')}>Get Started</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero" id="hero">
        <div className="hero-bg-pattern"></div>
        <div className="hero-grid"></div>
        <div className="hero-content">
          <div>
            <div className="hero-badge">
              <div className="hero-badge-dot"></div>
              Now in Beta — Trusted by 800+ Patients
            </div>
            <h1 className="hero-heading">
              AI-Assisted.<br/>
              <span className="accent">Doctor Verified.</span><br/>
              Delivered to Your Door.
            </h1>
            <p className="hero-sub">Upload your medical report, receive an AI-powered prescription suggestion, get it reviewed and approved by a licensed doctor, and have your medication delivered — all in one seamless platform.</p>
            <div className="hero-cta">
              <a href="/register" className="btn-hero">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="white"><path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/></svg>
                Upload Your Report
              </a>
              <a href="#how" className="btn-hero-outline">
                See How It Works
                <svg viewBox="0 0 20 20" width="16" height="16" fill="rgba(255,255,255,0.8)"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"/></svg>
              </a>
            </div>
            <div className="hero-trust">
              {['Doctor approved — always','HIPAA compliant','End-to-end encrypted'].map(t => (
                <div key={t} className="trust-item">
                  <div className="trust-check"><svg viewBox="0 0 10 10" stroke="#3CBEA0" fill="none" strokeWidth="2.5"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg></div>
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div className="hero-visual">
            <div style={{position:'relative'}}>
              <div className="hero-phone-mockup">
                <div className="mockup-header">
                  <div className="mockup-avatar">SR</div>
                  <div><div className="mockup-name">Sarah Rahman</div><div className="mockup-sub">Patient Dashboard</div></div>
                  <div className="status-pill status-approved">✓ Approved</div>
                </div>
                <div className="mockup-card">
                  <div className="mockup-card-title">🤖 AI Analysis Complete</div>
                  <div className="mockup-card-text">Based on your uploaded blood panel, possible indication: Type 2 Diabetes (early stage). Prescription suggestion generated and sent to Dr. Patel for review.</div>
                  <div className="mockup-drugs"><div className="drug-chip">Metformin 500mg</div><div className="drug-chip">Vitamin D</div></div>
                </div>
                <div className="mockup-card">
                  <div className="mockup-card-title">👨‍⚕️ Dr. Patel — Review Status</div>
                  <div className="mockup-progress">
                    <div className="progress-label"><span>Review in progress</span><span style={{color:'var(--mint)',fontWeight:600}}>80%</span></div>
                    <div className="progress-bar"><div className="progress-fill" style={{width:'80%'}}></div></div>
                  </div>
                </div>
                <div style={{display:'flex',gap:'10px',marginTop:'4px'}}>
                  <div style={{flex:1,padding:'12px',background:'#E6F8F2',borderRadius:'10px',textAlign:'center'}}><div style={{fontSize:'0.7rem',color:'#0F7A5A',fontWeight:600}}>Pharmacy</div><div style={{fontSize:'0.78rem',color:'var(--navy)',marginTop:'2px'}}>Matched ✓</div></div>
                  <div style={{flex:1,padding:'12px',background:'#EEF2FF',borderRadius:'10px',textAlign:'center'}}><div style={{fontSize:'0.7rem',color:'#4338CA',fontWeight:600}}>Delivery</div><div style={{fontSize:'0.78rem',color:'var(--navy)',marginTop:'2px'}}>Est. 2 hrs</div></div>
                </div>
              </div>
              <div className="float-card float-card-1"><div className="float-card-label">Prescriptions this week</div><div className="float-card-value" style={{color:'var(--mint)'}}>2,841</div></div>
              <div className="float-card float-card-2"><div className="float-card-label">Avg. doctor response</div><div className="float-card-value">24 min</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-section" id="how">
        <div className="container">
          <div className="text-center fade-up">
            <div className="section-label"><div className="section-label-line"></div> Simple Process</div>
            <h2 className="section-heading">From diagnosis to delivery<br/>in five steps</h2>
            <p className="section-sub center">Every step is designed around safety, transparency, and speed — with a licensed doctor at the center of every prescription.</p>
          </div>
          <div className="steps-grid">
            {[
              {n:'01',title:'Upload Report',desc:'Securely upload your symptoms, diagnosis, or medical reports in any format.',icon:<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>},
              {n:'02',title:'AI Analysis',desc:'Our AI engine analyses your data and generates a prescription suggestion — for doctor review only.',icon:<path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>},
              {n:'03',title:'Doctor Approval',desc:'A licensed physician reviews, modifies, or approves the prescription. No prescription is released without this step.',icon:<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>},
              {n:'04',title:'Pharmacy Match',desc:'AI matches your prescription with real-time pharmacy inventory, comparing price, availability, and distance.',icon:<path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>},
              {n:'05',title:'Doorstep Delivery',desc:'Pay securely, track in real-time, and receive your medication from a verified delivery driver.',icon:<path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>},
            ].map((s,i) => (
              <div key={s.n} className={`step-item fade-up stagger-${i+1}`}>
                <div className="step-circle">
                  <span className="step-num">{s.n}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#3CBEA0" strokeWidth="1.8" width="24" height="24">{s.icon}</svg>
                </div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features">
        <div className="container">
          <div className="text-center fade-up">
            <div className="section-label"><div className="section-label-line"></div> Platform Features</div>
            <h2 className="section-heading">Everything you need,<br/>nothing you don&apos;t</h2>
            <p className="section-sub center">Built for patients, doctors, pharmacies, and drivers — one ecosystem, seamlessly connected.</p>
          </div>
          <div className="features-grid">
            {[
              {icon:'🤖',title:'AI-Assisted Analysis',desc:'Advanced AI reviews your uploaded reports and medical history to generate prescription suggestions — always flagged as advisory and sent directly to your assigned doctor.'},
              {icon:'👨‍⚕️',title:'Doctor-Reviewed Prescriptions',desc:'Every prescription goes through a licensed physician before release. Doctors can approve, modify, or reject — with mandatory clinical notes.'},
              {icon:'🏥',title:'Real-Time Pharmacy Matching',desc:'Our system checks live inventory across partner pharmacies and matches your prescription by price, stock availability, and proximity to your location.'},
              {icon:'🚚',title:'Fast, Tracked Delivery',desc:'Once your order is placed, a verified driver is automatically assigned. Track every step from pharmacy pickup to your front door.'},
              {icon:'🔒',title:'Secure Patient Data',desc:'All medical data is encrypted at rest and in transit. Role-based access controls ensure only authorised personnel can access patient records.'},
              {icon:'📋',title:'Complete Audit Trail',desc:'Every prescription, approval, and action is logged in an immutable audit trail — meeting healthcare compliance standards and giving patients full transparency.'},
            ].map(f => (
              <div key={f.title} className="feature-card fade-up">
                <div className="feature-icon"><span style={{fontSize:'24px'}}>{f.icon}</span></div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="trust-section" id="trust">
        <div className="container">
          <div className="trust-grid">
            <div className="fade-up">
              <div className="section-label" style={{color:'var(--mint-light)'}}><div className="section-label-line"></div> Safety First</div>
              <div className="trust-heading">Built on the principle that doctors decide. Always.</div>
              <div className="trust-body">VeraMed&apos;s AI is a clinical support tool — not a prescriber. Every suggestion is reviewed by a licensed doctor before it reaches a patient. We are fully compliant with healthcare data regulations.</div>
              <div className="trust-badges">
                {[{icon:'🔒',label:'HIPAA Compliant',sub:'Data protection standard'},{icon:'🛡️',label:'GDPR Ready',sub:'EU data regulation'},{icon:'⚕️',label:'Doctor Verified',sub:'Mandatory review'},{icon:'🔐',label:'End-to-End Encrypted',sub:'AES-256 encryption'}].map(b => (
                  <div key={b.label} className="trust-badge">
                    <div className="trust-badge-icon"><span style={{fontSize:'18px'}}>{b.icon}</span></div>
                    <div><div className="trust-badge-label">{b.label}</div><div className="trust-badge-sub">{b.sub}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="fade-up stagger-2">
              <div className="trust-stats">
                {[{n:'800+',l:'Patients Served'},{n:'98%',l:'Doctor Approval Rate'},{n:'24min',l:'Avg. Review Time'},{n:'0',l:'Direct AI Prescriptions'},{n:'100%',l:'Audit Logged'},{n:'4.9★',l:'Patient Rating'}].map(s => (
                  <div key={s.l} className="stat-box"><div className="stat-num">{s.n}</div><div className="stat-label">{s.l}</div></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* USERS */}
      <section className="users-section" id="users">
        <div className="container">
          <div className="text-center fade-up">
            <div className="section-label"><div className="section-label-line"></div> Who It&apos;s For</div>
            <h2 className="section-heading">One platform, four roles</h2>
            <p className="section-sub center">Whether you&apos;re a patient, doctor, pharmacy, or driver — VeraMed is built around your workflow.</p>
          </div>
          <div className="user-tabs">
            {['patient','doctor','pharmacy','driver'].map(t => (
              <button key={t} className={`user-tab${activeTab===t?' active':''}`} onClick={() => setActiveTab(t)}>
                {t==='patient'?'🧑‍💼 Patients':t==='doctor'?'👨‍⚕️ Doctors':t==='pharmacy'?'🏥 Pharmacies':'🚗 Drivers'}
              </button>
            ))}
          </div>

          {activeTab==='patient' && (
            <div className="user-panel active">
              <div className="user-panel-content">
                <h3>Healthcare that fits around your life.</h3>
                <p>No waiting rooms. No repeat appointments for simple prescriptions. Upload your report, describe your symptoms, and let VeraMed handle the rest — with a doctor always in the loop.</p>
                <ul className="benefit-list">
                  {['Upload reports in seconds — PDF, image, or text','AI generates a prescription suggestion for doctor review','Receive approval notification within hours, not days','Order medication directly from approved prescription','Track your delivery in real-time from pharmacy to door'].map(b=>(
                    <li key={b} className="benefit-item"><div className="benefit-check"><svg viewBox="0 0 10 10" stroke="#3CBEA0" fill="none" strokeWidth="2.5"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg></div>{b}</li>
                  ))}
                </ul>
              </div>
              <div className="user-panel-visual">
                <div style={{fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:'16px'}}>Patient Flow</div>
                {[{t:'Register & complete profile',d:'Medical history, allergies, preferences',c:'var(--mint)'},{t:'Upload report or describe symptoms',d:'Secure, encrypted file upload',c:'var(--mint)'},{t:'AI analysis generated',d:'Sent to your assigned doctor for review',c:'var(--mint)'},{t:'Doctor approves prescription',d:'Notification sent to your account',c:'var(--mint)'},{t:'Order & track delivery',d:'Pay securely. Receive at home.',c:'var(--mint)'}].map((s,i,arr)=>(
                  <div key={s.t} className="user-flow-step" style={i===arr.length-1?{borderBottom:'none'}:{}}>
                    <div className="flow-dot-wrap"><div className="flow-dot" style={{background:s.c}}></div>{i<arr.length-1&&<div className="flow-line"></div>}</div>
                    <div><div className="flow-text-title">{s.t}</div><div className="flow-text-desc">{s.d}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab==='doctor' && (
            <div className="user-panel active">
              <div className="user-panel-content">
                <h3>Clinical tools that respect your expertise.</h3>
                <p>VeraMed&apos;s AI does the groundwork — you make the decision. Review AI-generated summaries, examine uploaded reports, and approve or modify prescriptions with full clinical context.</p>
                <ul className="benefit-list">
                  {['Structured AI summary for every patient case','Full access to uploaded medical reports and history','Approve, modify, or reject with mandatory clinical notes','Set your availability and response time preferences','Compliance-grade audit trail for every decision'].map(b=>(
                    <li key={b} className="benefit-item"><div className="benefit-check"><svg viewBox="0 0 10 10" stroke="#3CBEA0" fill="none" strokeWidth="2.5"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg></div>{b}</li>
                  ))}
                </ul>
              </div>
              <div className="user-panel-visual">
                <div style={{fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:'16px'}}>Doctor Flow</div>
                {[{t:'Case appears in your queue',d:'With AI summary and patient history',c:'#0F7A5A'},{t:'Review AI suggestion',d:'Full report access, flag warnings highlighted',c:'#0F7A5A'},{t:'Approve or modify prescription',d:'Edit medications, dosage, or duration',c:'#0F7A5A'},{t:'Add clinical notes',d:'For patient and pharmacy reference',c:'#0F7A5A'}].map((s,i,arr)=>(
                  <div key={s.t} className="user-flow-step" style={i===arr.length-1?{borderBottom:'none'}:{}}>
                    <div className="flow-dot-wrap"><div className="flow-dot" style={{background:s.c}}></div>{i<arr.length-1&&<div className="flow-line"></div>}</div>
                    <div><div className="flow-text-title">{s.t}</div><div className="flow-text-desc">{s.d}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab==='pharmacy' && (
            <div className="user-panel active">
              <div className="user-panel-content">
                <h3>A new revenue channel. Zero extra effort.</h3>
                <p>Join VeraMed&apos;s pharmacy network and receive matched orders directly to your dashboard. Manage inventory, set pricing, and get paid instantly on delivery confirmation.</p>
                <ul className="benefit-list">
                  {['Upload and manage your medication inventory','Receive orders matched to your stock in real time','Set your own pricing and margins','Instant payment processing on fulfilment','Analytics dashboard — top medications, revenue trends'].map(b=>(
                    <li key={b} className="benefit-item"><div className="benefit-check"><svg viewBox="0 0 10 10" stroke="#3CBEA0" fill="none" strokeWidth="2.5"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg></div>{b}</li>
                  ))}
                </ul>
              </div>
              <div className="user-panel-visual">
                <div style={{fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:'16px'}}>Pharmacy Flow</div>
                {[{t:'Onboard & upload inventory',d:'Import via CSV or connect your existing POS system',c:'#B06000'},{t:'Receive matched orders',d:'Instant notification when your pharmacy is selected',c:'#B06000'},{t:'Prepare the order',d:'Pack medication before the driver arrives',c:'#B06000'},{t:'Receive payment',d:'Instant settlement upon delivery confirmation',c:'#B06000'}].map((s,i,arr)=>(
                  <div key={s.t} className="user-flow-step" style={i===arr.length-1?{borderBottom:'none'}:{}}>
                    <div className="flow-dot-wrap"><div className="flow-dot" style={{background:s.c}}></div>{i<arr.length-1&&<div className="flow-line"></div>}</div>
                    <div><div className="flow-text-title">{s.t}</div><div className="flow-text-desc">{s.d}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab==='driver' && (
            <div className="user-panel active">
              <div className="user-panel-content">
                <h3>Flexible earnings. Meaningful work.</h3>
                <p>Join VeraMed&apos;s delivery network and earn by helping patients access their medication. Choose your own hours, receive automatic job assignments, and get paid per delivery.</p>
                <ul className="benefit-list">
                  {['Automatic assignment based on proximity and availability','In-app navigation from pharmacy to patient','Transparent per-delivery earnings + tips','Weekly payout with full earnings breakdown','Driver rating system and performance bonuses'].map(b=>(
                    <li key={b} className="benefit-item"><div className="benefit-check"><svg viewBox="0 0 10 10" stroke="#3CBEA0" fill="none" strokeWidth="2.5"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg></div>{b}</li>
                  ))}
                </ul>
              </div>
              <div className="user-panel-visual">
                <div style={{fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:'16px'}}>Driver Flow</div>
                {[{t:'Go online when ready',d:'Toggle availability in your driver app',c:'#4338CA'},{t:'Receive delivery request',d:'Auto-assigned by distance and order priority',c:'#4338CA'},{t:'Collect from pharmacy',d:'QR code confirmation and medication checklist',c:'#4338CA'},{t:'Deliver & confirm',d:'Patient signs digitally. Earnings credited instantly.',c:'#4338CA'}].map((s,i,arr)=>(
                  <div key={s.t} className="user-flow-step" style={i===arr.length-1?{borderBottom:'none'}:{}}>
                    <div className="flow-dot-wrap"><div className="flow-dot" style={{background:s.c}}></div>{i<arr.length-1&&<div className="flow-line"></div>}</div>
                    <div><div className="flow-text-title">{s.t}</div><div className="flow-text-desc">{s.d}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* BRAND */}
      <section className="brand-section" id="brand">
        <div className="container">
          <div className="text-center fade-up">
            <div className="section-label"><div className="section-label-line"></div> Brand Identity</div>
            <h2 className="section-heading">Suggested product names</h2>
            <p className="section-sub center">Five investor-ready name options — each with a distinct positioning angle.</p>
          </div>
          <div className="names-grid">
            {[{n:'VeraMed',t:'Vera (truth) + Med. Trust-first positioning.',featured:true},{n:'CureFlow',t:'End-to-end treatment journey. Delivery-forward.'},{n:'MedVerify',t:'Compliance-first. B2B/enterprise angle.'},{n:'PulseRx',t:'Modern, digital-native. Consumer appeal.'},{n:'ScriptAI',t:'Tech-forward. AI-first brand perception.'}].map((c,i)=>(
              <div key={c.n} className={`name-card fade-up stagger-${i+1}${c.featured?' featured':''}`}>
                {c.featured&&<div className="featured-badge">Recommended</div>}
                <div className="name-main">{c.n}</div>
                <div className="name-tag">{c.t}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:'60px'}}>
            <div className="text-center fade-up">
              <h3 style={{fontFamily:'var(--font-display)',fontSize:'1.6rem',fontWeight:600,color:'var(--navy)',marginBottom:'8px'}}>Tagline options</h3>
              <p style={{color:'var(--text-muted)',fontSize:'0.95rem'}}>Each captures a different brand voice — choose one that matches your investor pitch.</p>
            </div>
            <div className="taglines-grid" style={{marginTop:'32px'}}>
              {['AI-Assisted. Doctor Verified. Delivered to Your Door.','The prescription is ours. The decision is always the doctor\'s.','From diagnosis to doorstep — healthcare, reimagined.','Smart enough to suggest. Wise enough to ask a doctor first.'].map((t,i)=>(
                <div key={i} className={`tagline-card fade-up stagger-${i+1}`}>{t}</div>
              ))}
              <div className="tagline-card fade-up stagger-5" style={{gridColumn:'1/-1'}}>Where artificial intelligence meets genuine medical care.</div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-final">
        <div className="container" style={{position:'relative',zIndex:1}}>
          <div className="fade-up">
            <h2 className="cta-heading">Ready to transform<br/>how you access healthcare?</h2>
            <p className="cta-sub">Join thousands of patients, doctors, and pharmacies already on the VeraMed platform. Setup takes less than 5 minutes.</p>
            <div className="cta-actions">
              <a href="/register" className="btn-hero">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="white"><path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/></svg>
                Start as a Patient
              </a>
              <a href="/register" className="btn-hero-outline">Partner With Us</a>
            </div>
            <p style={{marginTop:'24px',fontSize:'0.78rem',color:'rgba(255,255,255,0.35)'}}>No commitment required. Free to get started. Doctor review fees apply only on prescription approval.</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-grid">
          <div>
            <div className="footer-logo">VeraMed</div>
            <div className="footer-tagline">AI-Assisted. Doctor Verified.<br/>Delivered to Your Door.<br/><br/>A healthcare platform built on trust, technology, and the unshakeable belief that doctors decide.</div>
          </div>
          <div>
            <div className="footer-col-title">Platform</div>
            <a className="footer-link" href="/register">For Patients</a>
            <a className="footer-link" href="/register">For Doctors</a>
            <a className="footer-link" href="/register">For Pharmacies</a>
            <a className="footer-link" href="/register">For Drivers</a>
          </div>
          <div>
            <div className="footer-col-title">Company</div>
            <a className="footer-link" href="#">About Us</a>
            <a className="footer-link" href="#">Safety &amp; Compliance</a>
            <a className="footer-link" href="#">Careers</a>
            <a className="footer-link" href="#">Press</a>
          </div>
          <div>
            <div className="footer-col-title">Legal</div>
            <a className="footer-link" href="#">Privacy Policy</a>
            <a className="footer-link" href="#">Terms of Service</a>
            <a className="footer-link" href="#">HIPAA Notice</a>
            <a className="footer-link" href="#">Cookie Policy</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-disclaimer">VeraMed is a technology platform that facilitates communication between patients and licensed healthcare professionals. VeraMed does not practice medicine, does not employ physicians, and does not issue prescriptions independently. All prescriptions are issued solely at the discretion of licensed medical practitioners.</div>
          <div style={{color:'rgba(255,255,255,0.25)',fontSize:'0.8rem'}}>© 2025 VeraMed Technologies Ltd.</div>
        </div>
      </footer>
    </>
  );
}
