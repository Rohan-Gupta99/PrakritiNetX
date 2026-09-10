package org.prakritinetx.fieldflash.ui.wizard

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import org.prakritinetx.fieldflash.R
import org.prakritinetx.fieldflash.databinding.FragmentStep2ConnectBinding
import org.prakritinetx.fieldflash.engine.serial.SerialConnectionState
import org.prakritinetx.fieldflash.ui.MainActivity
import org.prakritinetx.fieldflash.ui.MainViewModel

class Step2ConnectFragment : Fragment() {

    private var _binding: FragmentStep2ConnectBinding? = null
    private val binding get() = _binding!!
    private val viewModel: MainViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentStep2ConnectBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupListeners()
        observeViewModel()
    }

    private fun setupListeners() {
        binding.btnConnectUsb.setOnClickListener {
            val drivers = viewModel.getAvailableUsbDrivers()
            if (drivers.isEmpty()) {
                Toast.makeText(
                    requireContext(),
                    "No USB-Serial devices found. Connect node with USB-OTG cable.",
                    Toast.LENGTH_LONG
                ).show()
                return@setOnClickListener
            }
            val driver = drivers[0]
            viewModel.connectSerial(driver)
        }

        binding.btnDisconnectUsb.setOnClickListener {
            viewModel.disconnectSerial()
        }

        binding.btnHandshakeChip.setOnClickListener {
            if (viewModel.serialState.value !is SerialConnectionState.Connected) {
                Toast.makeText(requireContext(), "Connect USB first before handshake.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            viewModel.handshakeAndIdentifyChip()
        }

        binding.btnNextToFlash.setOnClickListener {
            (activity as? MainActivity)?.navigateToStep(3)
        }
    }

    private fun observeViewModel() {
        viewModel.selectedPackage.observe(viewLifecycleOwner) { pkg ->
            if (pkg != null) {
                binding.tvTargetFirmware.text = "${pkg.displayName} (${pkg.chipType.uppercase()} ${pkg.version})"
            } else {
                binding.tvTargetFirmware.text = "No package selected (Return to Step 1)"
            }
        }

        viewModel.serialState.observe(viewLifecycleOwner) { state ->
            when (state) {
                is SerialConnectionState.Connected -> {
                    binding.tvUsbStatusBadge.text = "CONNECTED"
                    binding.tvUsbStatusBadge.setBackgroundResource(R.drawable.bg_badge_success)
                    binding.tvUsbDetails.text = "Device: ${state.deviceName}\nDriver: ${state.driverName}\nVID: 0x${Integer.toHexString(state.vendorId)} | PID: 0x${Integer.toHexString(state.productId)}"
                    binding.btnConnectUsb.isEnabled = false
                    binding.btnDisconnectUsb.isEnabled = true
                    binding.btnHandshakeChip.isEnabled = true
                }
                is SerialConnectionState.Connecting -> {
                    binding.tvUsbStatusBadge.text = "CONNECTING..."
                    binding.tvUsbStatusBadge.setBackgroundResource(R.drawable.bg_badge_warning)
                }
                is SerialConnectionState.Disconnected -> {
                    binding.tvUsbStatusBadge.text = "DISCONNECTED"
                    binding.tvUsbStatusBadge.setBackgroundResource(R.drawable.bg_badge_error)
                    binding.tvUsbDetails.text = "Connect phone to node's USB-C port via USB-OTG adapter. Supported chips: CP2102, CH340, FTDI, CDC-ACM."
                    binding.btnConnectUsb.isEnabled = true
                    binding.btnDisconnectUsb.isEnabled = false
                    binding.btnHandshakeChip.isEnabled = false
                }
                is SerialConnectionState.Error -> {
                    binding.tvUsbStatusBadge.text = "ERROR"
                    binding.tvUsbStatusBadge.setBackgroundResource(R.drawable.bg_badge_error)
                    binding.tvUsbDetails.text = "Error: ${state.message}"
                    binding.btnConnectUsb.isEnabled = true
                    binding.btnDisconnectUsb.isEnabled = false
                }
            }
        }

        viewModel.detectedChip.observe(viewLifecycleOwner) { chip ->
            updateChipInfoText()
        }

        viewModel.detectedNodeId.observe(viewLifecycleOwner) { id ->
            updateChipInfoText()
        }
    }

    private fun updateChipInfoText() {
        val chip = viewModel.detectedChip.value ?: "Not Handshaked"
        val id = viewModel.detectedNodeId.value?.takeIf { it.isNotBlank() } ?: "Unknown"
        binding.tvChipInfo.text = "Detected Silicon Target: $chip\nUnique Node Hardware ID: $id"
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

