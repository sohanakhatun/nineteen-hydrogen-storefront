import React from 'react';

const UspPointers = ({fields}) => {
  return (
    <div className="usp-item flex flex-col items-center gap-2 text-center ">
      {fields.map((field) => (
        <>
          {field.key === 'icon' && (
            <img
              src={field.reference.image.url}
              width={40}
              height={40}
              alt="usp icon"
              className="usp-icon"
            />
          )}
          {field.key === 'text' && <p key={field.key}>{field.value}</p>}
        </>
      ))}
    </div>
  );
};

export default UspPointers;
