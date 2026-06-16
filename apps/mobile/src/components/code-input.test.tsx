import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { TextInput } from 'react-native';

import { CodeInput } from './code-input';

function Harness({ onComplete }: { onComplete: (v: string) => void }) {
  const [value, setValue] = useState('');
  return <CodeInput value={value} onChange={setValue} onComplete={onComplete} />;
}

describe('CodeInput', () => {
  it('strips non-digits, caps at 6, and fires onComplete when full', () => {
    const onComplete = jest.fn();
    render(<Harness onComplete={onComplete} />);

    const input = screen.UNSAFE_getByType(TextInput);
    fireEvent.changeText(input, '12ab34');
    expect(onComplete).not.toHaveBeenCalled(); // only 4 digits so far

    fireEvent.changeText(input, '123456789');
    expect(onComplete).toHaveBeenCalledWith('123456'); // capped at 6 → complete
  });
});
