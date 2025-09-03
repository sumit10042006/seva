import React from 'react';
import { Play, CheckCircle } from 'lucide-react';
import { ContentData } from '../types';

interface HeroProps {
  content: ContentData;
}

export const Hero: React.FC<HeroProps> = ({ content }) => {
  return (
    <section className="bg-gradient-to-br from-indigo-50 via-white to-emerald-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            {content.hero.headline}
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 leading-relaxed">
            {content.hero.subhead}
          </p>
          
          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center items-center gap-4 mb-8">
            {content.hero.trustRow.map((item, index) => (
              <div key={index} className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full shadow-sm">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-gray-700">{item}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button className="bg-indigo-600 text-white px-8 py-4 rounded-xl hover:bg-indigo-700 transition-all transform hover:scale-105 font-semibold text-lg shadow-lg">
              {content.hero.primaryCTA}
            </button>
            <button className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl hover:border-indigo-600 hover:text-indigo-600 transition-all font-semibold text-lg flex items-center justify-center space-x-2">
              <Play className="w-5 h-5" />
              <span>{content.hero.secondaryCTA}</span>
            </button>
          </div>

          {/* Microcopy */}
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            {content.hero.microcopy}
          </p>
        </div>
      </div>
    </section>
  );
};