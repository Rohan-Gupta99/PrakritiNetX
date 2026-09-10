package org.prakritinetx.fieldflash.ui.wizard

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import org.prakritinetx.fieldflash.R
import org.prakritinetx.fieldflash.databinding.FragmentStep3FlashBinding
import org.prakritinetx.fieldflash.engine.serial.SerialConnectionState
import org.prakritinetx.fieldflash.ui.MainActivity
import org.prakritinetx.fieldflash.ui.MainViewModel
import java.util.Locale

class Step3FlashFragment : Fragment() {

    private var _binding: FragmentStep3FlashBinding? = null
    private val binding get() = _binding!!
    private val viewModel: MainViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentStep3FlashBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupListeners()
        observeViewModel()
    }

    private fun setupListeners() {
        binding.btnStartFlash.setOnClickListener {
            if (viewModel.serialState.value !is SerialConnectionState.Connected) {
                Toast.makeText(requireContext(), "Connect USB device in Step 2 first.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (viewModel.selectedPackage.value == null) {
                Toast.makeText(requireContext(), "Select a firmware package in Step 1 first.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            viewModel.startFlashing()
        }

        binding.btnClearTerminal.setOnClickListener {
            viewModel.clearLogs()
        }

        binding.btnNextToVerify.setOnClickListener {
            (activity as? MainActivity)?.navigateToStep(4)
        }
    }

    private fun observeViewModel() {
        viewModel.selectedPackage.observe(viewLifecycleOwner) { pkg ->
            if (pkg != null) {
                val isK210 = pkg.chipType.equals("k210", ignoreCase = true)
                if (isK210) {
                    binding.tvFlashEngineTitle.text = "KENDRYTE K210 ISP FLASH ENGINE"
                    binding.tvChipIndicator.text = "K210"
                    binding.tvFlashOffsets.text = "Package: .kfpkg bundle or app .bin at 0x000000"
                } else {
                    binding.tvFlashEngineTitle.text = "ESPRESSIF ESP32 SERIAL FLASH ENGINE"
                    binding.tvChipIndicator.text = "ESP32"
                    binding.tvFlashOffsets.text = "Offsets: 0x1000 (Bootloader) | 0x8000 (Partitions) | 0x10000 (App)"
                }
            }
        }

        viewModel.flashProgress.observe(viewLifecycleOwner) { state ->
            binding.progressBarFlash.progress = state.percent
            binding.tvPercent.text = "${state.percent}%"
            binding.tvFlashStatus.text = state.statusText

            val writtenKb = state.bytesWritten / 1024
            val totalKb = state.totalBytes / 1024
            binding.tvSpeedBytes.text = String.format(
                Locale.US,
                "%d / %d KB (%.1f KB/s) - %s",
                writtenKb,
                totalKb,
                state.speedKbps,
                state.currentFileName
            )

            if (state.isFlashing) {
                binding.btnStartFlash.isEnabled = false
                binding.btnStartFlash.text = "FLASHING IN PROGRESS..."
                binding.btnNextToVerify.visibility = View.GONE
            } else {
                binding.btnStartFlash.isEnabled = true
                binding.btnStartFlash.text = getString(R.string.start_flash)
                if (state.isSuccess) {
                    binding.btnNextToVerify.visibility = View.VISIBLE
                    binding.tvFlashStatus.setTextColor(requireContext().getColor(R.color.status_success))
                } else if (state.isError) {
                    binding.tvFlashStatus.setTextColor(requireContext().getColor(R.color.status_error))
                }
            }
        }

        viewModel.terminalLogs.observe(viewLifecycleOwner) { logs ->
            binding.tvTerminalOutput.text = logs.takeLast(100).joinToString("\n")
            binding.scrollTerminal.post {
                binding.scrollTerminal.fullScroll(View.FOCUS_DOWN)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

